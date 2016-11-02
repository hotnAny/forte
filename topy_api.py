#!/usr/bin/env python

##########################################################################
#
#   useful apis for using topy
#
##########################################################################
import argparse
from sys import argv
import sys
sys.path.append('topy/scripts')
import subprocess
import json
import math
import time
from numpy import ndarray
from PIL import Image

from nodenums import node_nums_3d
from nodenums import elm_num_3d
from optimise import main
# from skeletonize import skeletonize
import traceback

INFINITY = 1e9
EPSILON = 1e-9
ANALYSIS = 0
OPTIMIZATION = 1
TOPYPATH = './scripts/optimise.py'
SHOW_DEBUG = True

tpd_template = '{"PROB_TYPE":"comp", "PROB_NAME":"NONAME", "ETA": "0.4", "DOF_PN": "3", "VOL_FRAC": "0.3", "FILT_RAD": "1.5", "ELEM_K": "H8", "NUM_ELEM_X":"10", "NUM_ELEM_Y":"10", "NUM_ELEM_Z":"10", "NUM_ITER":"100", "FXTR_NODE_X":"", "FXTR_NODE_Y":"", "FXTR_NODE_Z":"", "LOAD_NODE_X":"", "LOAD_VALU_X":"", "LOAD_NODE_Y":"", "LOAD_VALU_Y":"", "LOAD_NODE_Z":"", "LOAD_VALU_Z":"", "P_FAC":"1", "P_HOLD":"15", "P_INCR":"0.2", "P_CON":"1", "P_MAX":"3", "Q_FAC":"1", "Q_HOLD":"15", "Q_INCR":"0.05", "Q_CON":"1", "Q_MAX":"5"}';

#
#   bound a list of values respectively to bounds
#
def bound(ls, ls_min, ls_max):
    ls_bounded = []
    for i in xrange(0, len(ls)):
        ls_bounded.append(min(max(ls[i], ls_min[i]), ls_max[i]))
    return ls_bounded

#
#   check if a point p is in the segment p0-p1 with t0-t1 thickness
#
def is_in_segment(p, p0, p1, t0, t1):
    # check if p's projection is on p0-p1
    v0 = [p[0]-p0[0], p[1] - p0[1]]
    u10 = [p1[0]-p0[0], p1[1] - p0[1]]
    l = math.sqrt(u10[0]**2 + u10[1]**2)
    dp0 = (v0[0] * u10[0] + v0[1] * u10[1]) / l

    v1 = [p[0]-p1[0], p[1] - p1[1]]
    u01 = [p0[0]-p1[0], p0[1] - p1[1]]
    dp1 = (v1[0] * u01[0] + v1[1] * u01[1]) / l

    if dp0 > l or dp1 > l:
        # check if p is close enough to p0 p1
        if abs(v0[0])>t0 or abs(v0[1])>t0 or abs(v1[0])>t1 or abs(v1[1])>t1:
            return False

        if v0[0]**2 + v0[1]**2 <= t0**2 or v1[0]**2 + v1[1]**2 <= t1**2:
            return True
        else:
            return False

    # if on, check if p is in the cone given by t0, t1
    dx1 = p0[0] - p[0]
    dy1 = p0[1] - p[1]
    dx2 = p1[0] - p[0]
    dy2 = p1[1] - p[1]
    tu = (dx2 - dx1) * dx1 + (dy2 - dy1) * dy1
    tb = (p1[0] - p0[0])**2 + (p1[1] - p0[1])**2
    t = -tu / tb

    dist = dx1**2 + dy1**2 - tu**2 / tb
    proj = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]

    lp = math.sqrt((proj[0]-p0[0])**2 + (proj[1]-p0[1])**2)
    tp = lp/l * t0 + (1-lp/l) * t1

    return dist < tp * tp # radius = thickness / 2

def on_left_side(p, p0, p1):
    v = [p[0]-p0[0], p[1]-p0[1]]
    v1 = [p1[0]-p0[0], p1[1]-p0[1]]
    if abs(v[0]-v1[0]) < EPSILON and abs(v[1]-v1[1]) < EPSILON:
        return None
    return v1[0]*v[1] - v1[1]*v[0] > 0

#
#   safely retrieve key-value from object
#
def safe_retrieve_one(buffer, key, alt):
    return buffer[key][0] if key in buffer and len(buffer[key]) > 0 else alt

def safe_retrieve_all(buffer, key, alt):
    return buffer[key] if key in buffer else alt

#
#   generate the tpd file for running topy
#
def gen_tpd(designObj, resolution, material):
    # read parameters of the design & function spec.
    design = safe_retrieve_all(designObj, 'design', None)
    loads = safe_retrieve_all(designObj, 'loads', None)
    clearances = safe_retrieve_all(designObj, 'clearances', None)
    boundaries = safe_retrieve_all(designObj, 'boundaries', None)

    # compute resolution of the voxel grid ---------------------------------------------------------------
    vmin = [INFINITY, INFINITY, INFINITY]
    vmax = [-INFINITY, -INFINITY, -INFINITY]
    for edge in design:
        points = edge['points']
        for point in points:
            for i in xrange(0, 3):
                vmin[i] = min(vmin[i], point[i])
                vmax[i] = max(vmax[i], point[i])

    dim_voxel = max((vmax[0] - vmin[0]) / resolution, (vmax[1] - vmin[1]) / resolution)

    nelx = int(math.ceil((vmax[0] - vmin[0]) / dim_voxel))
    nely = int(math.ceil((vmax[1] - vmin[1]) / dim_voxel))

    relaxation = 0.1
    vmin[0] -= nelx * relaxation * dim_voxel
    vmin[1] -= nely * relaxation * dim_voxel
    vmax[0] += nelx * relaxation * dim_voxel
    vmax[1] += nely * relaxation * dim_voxel

    nelx_old = nelx
    nely_old = nely
    nelx = int(nelx * (1+ 2 * relaxation))
    nely = int(nely * (1+ 2 * relaxation))

    # convert points to voxels --------------------------------------------------------------------------
    for edge in design:
        edge['voxels'] = []
        edge['voxelmin'] = [INFINITY, INFINITY]
        edge['voxelmax'] = [-INFINITY, -INFINITY]

        for point in edge['points']:
            vx = math.floor((point[0]-vmin[0])/dim_voxel)
            vy = math.floor((point[1]-vmin[1])/dim_voxel)
            voxel = [vx, vy]
            edge['voxels'].append(voxel)
            for i in xrange(0, len(voxel)):
                edge['voxelmin'][i] = min(edge['voxelmin'][i], voxel[i])
                edge['voxelmax'][i] = max(edge['voxelmax'][i], voxel[i])

        maxThick = 0
        for t in edge['thickness']:
            maxThick = max(t, maxThick)
        maxThick /= dim_voxel

        edge['voxelmin'][0] -= maxThick
        edge['voxelmin'][1] -= maxThick
        edge['voxelmax'][0] += maxThick
        edge['voxelmax'][1] += maxThick

    # HACK                      ------------------------------------------------------------------------
    pasv_elms = []
    if 'expand' in designObj:
        for j in xrange(0, nely):
            for i in xrange(0, nelx):
                pasv_elms.append([i, j, 1])

    # compute the design elements ------------------------------------------------------------------------
    actv_elms = []
    actv_elms_out = []
    fav_elms = []
    fav_vals = []
    margin = 3  # voxel margin between pasv_elms and actv_elms

    print '-----------------------------------------------------------------------------------------', design[0]['thickness'][0] / dim_voxel

    elms_record = []
    for j in xrange(0, nely):
        for i in xrange(0, nelx):
            elms_record.append(0)

    for edge in design:
        voxels = edge['voxels']
        thickness = edge['thickness']
        edge_fav_vals = safe_retrieve_all(edge, 'favVals', None) # account for legacy design that has no favVals
        for k in xrange(0, len(voxels) - 1):
            p0 = voxels[k]
            p1 = voxels[k+1]

            t0 = thickness[k] / dim_voxel
            t1 = thickness[k+1] / dim_voxel

            # if t0 < 0.01 and t1 < 0.01:
            #     continue

            for j in xrange(0, nely):
                if j < edge['voxelmin'][1] or j > edge['voxelmax'][1]:
                    continue

                for i in xrange(0, nelx):
                    if i < edge['voxelmin'][0] or i > edge['voxelmax'][0]:
                        continue
                    try:
                        if elms_record[j * nelx + i] == 1:
                            continue

                        # NOTE: added a check on favor value, which must be 1 to be actv_elms
                        if is_in_segment([i * 1.0, j * 1.0], p0, p1, t0/2, t1/2):
                            if edge_fav_vals == None or edge_fav_vals[k] == 1:
                                actv_elms.append([i, j, 1])
                            else:
                                fav_elms.append([i, j, 1])
                                fav_vals.append(str(edge_fav_vals[k]))
                            elms_record[j * nelx + i] = 1
                        if is_in_segment([i * 1.0, j * 1.0], p0, p1, t0/2 + margin, t1/2 + margin):
                            actv_elms_out.append([i, j, 1])
                    except:
                        # traceback.print_exc()
                        continue

    # compute load points ----------------------------------------------------------------------------------
    load_points = []
    load_values_x = []
    load_values_y = []
    for load in loads:
        points = load['points']
        vectors = load['vectors']
        for i in xrange(0, len(points)):
            point = bound(points[i], vmin, vmax)
            load_point = [int((point[0]-vmin[0])/dim_voxel), int((point[1]-vmin[1])/dim_voxel)]
            load_points.append(load_point)
            load_values_x.append(vectors[i][0])     # assuming vectors' norms sum up to 1
            load_values_y.append(vectors[i][1])

    # compute clearances -----------------------------------------------------------------------------------
    for clearance in clearances:
        voxels_clearance = []
        for point in clearance:
            if len(point) == 3:     # from user spec
                point = bound(point, vmin, vmax)
                cx = math.floor((point[0]-vmin[0])/dim_voxel)
                cy = math.floor((point[1]-vmin[1])/dim_voxel)
                voxels_clearance.append([cx, cy])
            else:                   # from iteration
                voxels_clearance.append(point)

        p0 = voxels_clearance[0]
        p1 = voxels_clearance[2]
        p2 = voxels_clearance[6]
        p3 = voxels_clearance[4]

        for j in xrange(0, nely):
            for i in xrange(0, nelx):
                p = [i*1.0, j*1.0]
                side0 = on_left_side(p, p0, p1)
                side1 = on_left_side(p, p1, p2)
                if side0 != side1 or side0 == None:
                    continue

                side2 = on_left_side(p, p2, p3)
                if side1 != side2 or side2 == None:
                    continue

                side3 = on_left_side(p, p3, p0)
                if side2 != side3:
                    continue

                to_include = True
                for elm in actv_elms_out:
                    if elm[0] == i and elm[1] == j:
                        to_include = False
                        break

                if to_include:
                    pasv_elms.append([i, j, 1])

    # set extended domain to be passive --------------------------------------------------------------------
    # dnelx = int(math.floor((nelx - nelx_old) / 2))
    # dnely = int(math.floor((nely - nely_old) / 2))
    # for j in xrange(0, dnely):
    #     for i in xrange(0, nelx):
    #         pasv_elms.append([i, j, 1])
    #         pasv_elms.append([i, nely - 1 - j, 1])
    #
    # for j in xrange(0, nely):
    #     for i in xrange(0, dnelx):
    #         pasv_elms.append([i, j, 1])
    #         pasv_elms.append([nelx - 1 - i, j, 1])

    # compute boundaries -----------------------------------------------------------------------------------
    boundary_elms = []

    for boundary in boundaries:
        voxels = []

        for point in boundary:
            point = bound(point, vmin, vmax)
            bx = math.floor((point[0]-vmin[0])/dim_voxel)
            by = math.floor((point[1]-vmin[1])/dim_voxel)

            voxels.append([bx, by])

        for k in xrange(0, len(voxels) - 1):
            p0 = voxels[k]
            p1 = voxels[k+1]

            boundary_elms.append([int(p0[0]), int(p0[1])])
            boundary_elms.append([int(p1[0]), int(p1[1])])
            # empirically set boundary to have width 5*2=10
            t0 = 5
            t1 = 5

            xmin = min(p0[0], p1[0]) - 1
            xmax = max(p0[0], p1[0]) + 1
            ymin = min(p0[1], p1[1]) - 1
            ymax = max(p0[1], p1[1]) + 1

            xmin = int(max(0, xmin))
            xmax = int(min(xmax, vmax[0]))
            ymin = int(max(0, ymin))
            ymax = int(min(ymax, vmax[1]))

            for j in xrange(ymin, ymax):
                for i in xrange(xmin, xmax):
                    try:
                        if is_in_segment([i * 1.0, j * 1.0], p0, p1, t0, t1):
                            boundary_elms.append([i, j, 1])
                    except:
                        continue

    # DEBUG: print out the design and specs --------------------------------------------------------------
    if SHOW_DEBUG:
        str_voxelgrid = ''
        for j in xrange(0, nely):
            debug_voxelrow = ''
            for i in xrange(0, nelx):
                debug_voxelrow += ('  ')
            str_voxelgrid += debug_voxelrow + ' \n'

        debug_voxelgrid = list(str_voxelgrid)

        for cp in pasv_elms:
            i = cp[0]
            j = cp[1]
            idx = 2 * (j * (nelx + 1) + nelx - 1 - i) + 1
            if idx < len(debug_voxelgrid):
                debug_voxelgrid[idx] = 'x'

        for elm in actv_elms:
            i = elm[0]
            j = elm[1]
            idx = j * (nelx + 1) + nelx - 1 - i
            debug_voxelgrid[2 * idx + 1] = '$'

        for elm in fav_elms:
            i = elm[0]
            j = elm[1]
            idx = j * (nelx + 1) + nelx - 1 - i
            debug_voxelgrid[2 * idx + 1] = '.'

        for lp in load_points:
            i = lp[0]
            j = lp[1]
            idx = 2 * (j * (nelx + 1) + nelx - 1 - i) + 1
            if idx < len(debug_voxelgrid):
                debug_voxelgrid[idx] = 'O'


        for bp in boundary_elms:
            i = bp[0]
            j = bp[1]
            idx = 2 * (j * (nelx + 1) + nelx - 1 - i) + 1
            if idx < len(debug_voxelgrid):
                debug_voxelgrid[idx] = '*'

        # print ''.join(debug_voxelgrid)[::-1]
    # END DEBUG

    # prep for tpd file -----------------------------------------------------------------------------------
    str_load_points = ''
    load_values_x_str = []
    load_values_y_str = []
    load_nodes = [node_nums_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1) for x in load_points]
    for i in xrange(0, len(load_points)):
        # instead of 8 nodes, only keep 1
        node_str_array = [str(load_nodes[i][0])]

        str_load_points += ';'.join(node_str_array)
        if i < len(load_points) - 1:
            str_load_points += ';'

        load_values_x_str.append(str(load_values_x[i]/len(node_str_array)) + '@' + str(len(node_str_array)))
        load_values_y_str.append(str(load_values_y[i]/len(node_str_array)) + '@' + str(len(node_str_array)))

    boundary_nodes = [node_nums_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1) for x in boundary_elms]
    str_boundary = ''
    for i in xrange(0, len(boundary_nodes)):
        node_str_array = [str(x) for x in boundary_nodes[i]]
        str_boundary += ';'.join(node_str_array)
        if i < len(boundary_nodes) - 1:
            str_boundary += ';'


    # print len(actv_elms)
    # print len(fav_elms)

    #
    #
    # HACK for experiment
    if 'expand' in designObj:
        material = 1.0 * len(actv_elms) / (nelx * nely)
    elif 'base_mat' in designObj:
        material = designObj['base_mat']
    #
    #
    #
    else:
        material *= 1.0 * (len(actv_elms) + len(fav_elms)) / (nelx * nely)

    ## normal cases
    # material = material * 1.0 * (len(actv_elms) + len(fav_elms)) / (nelx * nely)
    print '--------------------------------------------------------------------------------------------------[xac] relative amount of material ' + str(material)

    # NOTE: remove for experiment
    # material = bound([material], [0.05], [0.35])[0]
    # print '--------------------------------------------------------------------------------------------------[xac] bounded amount of material ' + str(material)

    # write to tpd file -----------------------------------------------------------------------------------
    tpd = json.loads(tpd_template)
    tpd['PROB_NAME'] = 'forte_' + str(long(time.time())%1e8) + '_' + format(material, '1.2f')
    tpd['VOL_FRAC'] = material
    tpd['NUM_ELEM_X'] = nelx
    tpd['NUM_ELEM_Y'] = nely
    tpd['NUM_ELEM_Z'] = 1
    tpd['FXTR_NODE_X'] = str_boundary
    tpd['FXTR_NODE_Y'] = str_boundary
    tpd['FXTR_NODE_Z'] = str_boundary
    tpd['LOAD_NODE_X'] = str_load_points
    tpd['LOAD_VALU_X'] = ';'.join(load_values_x_str)
    tpd['LOAD_NODE_Y']= str_load_points
    tpd['LOAD_VALU_Y'] = ';'.join(load_values_y_str)

    # TODO: check this
    if 'ignore' in designObj:
        print '-------------------------------------------------------------------------------------------------- [xac] ignoring user design'
    else:
        tpd['ACTV_ELEM'] = ';'.join([str(elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1)) for x in actv_elms])
        tpd['PASV_ELEM'] = ';'.join([str(elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1)) for x in pasv_elms])
        tpd['FAV_ELEM'] = ';'.join([str(elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1)) for x in fav_elms])
        tpd['FAV_VALU'] = ';'.join(fav_vals)

    return tpd, debug_voxelgrid

def analyze(tpd):
    return call_topy(tpd, ANALYSIS, False)

def optimize(tpd, grad):
    return call_topy(tpd, OPTIMIZATION, grad, True)

#
#   run topy given a tpd object (not file)
#
def call_topy(tpd, query, grad, imagerize):
    tpd_path = save_tpd(tpd)
    probname = main([TOPYPATH, tpd_path, str(query), grad])
    subprocess.call('rm ' + tpd_path, shell=True)
    if imagerize == True:
        fname = probname + '.bmp'
        save_vxg_to_image(probname + '_optimized.vxg', fname)
    return probname

def save_tpd(tpd):
    str_tpd = '[ToPy Problem Definition File v2007]\n'
    for var in tpd:
        str_tpd += var + ': ' + str(tpd[var]) + '\n'

    tpd_path = 'forte_' + time.strftime("%m%d_%H%M%S") + '.tpd'
    f = open(tpd_path, 'w')
    f.write(str_tpd)
    f.close()
    return tpd_path

def save_vxg_to_image(vxg_path, fname):
    str_vxg = open(vxg_path).read()
    rows_vxg = str_vxg.split('\n')
    m = len(rows_vxg)
    n = len(rows_vxg[0].split(','))
    vxg = []
    for i in xrange(0, m):
        row_vxg = rows_vxg[i].split(',')
        vxg.append([float(x) for x in row_vxg])

    h = m
    w = n
    pixels = []
    for i in xrange(0, h):
        for j in xrange(0, w):
            pixels.append(255 if float(vxg[h - 1 - i][j]) < 0.5 else 0)

    img = Image.new('L', (w, h))
    img.putdata(pixels)
    img.save(fname)

#
#   main function entry point
#
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='an interface for calling topy.')
    parser.add_argument('path', metavar='path', type=str, help='path to a design file')
    parser.add_argument('-r', dest='resolution', help='resolution of the voxel grid.')
    parser.add_argument('-m', dest='material', help='amount of material to be used for optimization.')
    parser.add_argument('-d', dest='dissimilarity', help='the dissimilarity allowed between user and system designs.')

    args = parser.parse_args()

    # num_req_params = 4
    # if len(argv) < num_req_params + 1:
    #     print 'usage: ./gen_designs.py <path_to_design_file> <reslution> <amount_of_material> <gradient>'
    #     quit()

    design = json.loads(open(args.path, 'r').read())
    resolution = int(args.resolution)
    material = float(args.material)
    gradient = float(args.dissimilarity)

    tpd, debug_voxelgrid = gen_tpd(design, resolution, material)
    print ''.join(debug_voxelgrid)[::-1]
    probname = optimize(tpd, gradient)
    sub_outpath = args.path + '_' + str(long(time.time())) + '_' + str(resolution) + '_' + str(material) + '_' + str(gradient)
    print sub_outpath
    subprocess.call('mkdir ' + sub_outpath, shell=True)
    subprocess.call('mv ' + probname + '* ' + sub_outpath, shell=True)

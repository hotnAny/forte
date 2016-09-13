#!/usr/bin/env python

##########################################################################
#
#   generate designs using topology optimization
#
##########################################################################

from sys import argv
import json
from topy_api import *
from random import shuffle

RESOLUTION = 64
AMNTMAT = 2

def gen_design(original, favored, disfavored, resolution, material):
    tpd, debug_voxelgrid = gen_tpd(original, resolution, material)
    # print ''.join(debug_voxelgrid)[::-1]
    nelx = int(tpd['NUM_ELEM_X'])
    nely = int(tpd['NUM_ELEM_Y'])
    print '[xac] ', nelx, ' x ', nely

    # specify favored elements
    fav_elms = []
    if favored != None:
        # shuffle(favored)
        for edge in favored:
            fav_elms += [edge['node1'], edge['node2']]
            fav_elms += edge['points']

            # break # HACK: try 1st edge

        # DEBUG
        for elm in fav_elms:
            i = elm[0]
            j = elm[1]
            idx = j * (nelx + 1) + nelx - 1 - i
            debug_voxelgrid[2 * idx + 1] = 'v'

        tpd['FAVORED'] = ';'.join([str(elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1)) for x in fav_elms])

    # specify disfavored elements
    dfav_elms = []
    if disfavored != None:
        for edge in disfavored:
            mid_point = (edge['node1'][0] + edge['node2'][0]) / 2, (edge['node1'][1] + edge['node2'][1]) / 2
            # dfav_elms += [edge['node1'], edge['node2']]
            dfav_elms.append(mid_point)

            # break # HACK: try 1st edge

        # DEBUG
        for elm in dfav_elms:
            i = elm[0]
            j = elm[1]
            idx = j * (nelx + 1) + nelx - 1 - i
            debug_voxelgrid[2 * idx + 1] = '@'

        tpd['DISFAVORED'] = ';'.join([str(elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1)) for x in dfav_elms])

    # debug
    df_favored = get_distance_field([elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1) for x in fav_elms], nelx, nely)
    df_disfavored = get_distance_field([elm_num_3d(nelx, nely, 1, x[0]+1, x[1]+1, 1) for x in dfav_elms], nelx, nely)

    for i in xrange(0, nelx):
        for j in xrange(0, nely):
            idx = j * (nelx + 1) + nelx - 1 - i
            if df_favored[i][j] < 2:
                debug_voxelgrid[2 * idx + 1] = 'v'
            if df_disfavored[i][j] < 2:
                debug_voxelgrid[2 * idx + 1] = '@'

    print ''.join(debug_voxelgrid)[::-1]

    optimize(tpd)

    return tpd['PROB_NAME']

#
#   [xac] compute distance field (2d)
#
def get_distance_field(elms, nelx, nely):
    infinity = 1e6
    epsilon = 1e-6
    df = []

    # initialize distance field
    for i in xrange(0, nelx):
        row = []
        for j in xrange(0, nely):
            row.append(infinity)
        df.append(row)

    cnt = 0
    buf_prev = []
    num = nelx * nely
    max_val = 0
    neighbors = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]

    for elm_num in elms:
        # elm_num -= 1
        mpz = int(math.floor(elm_num / (nelx * nely)))
        mpx = int(math.floor((elm_num - mpz * (nelx * nely)) / nely))
        mpy = int(math.floor(elm_num - mpz * (nelx * nely) - mpx * nely))
        df[mpx][mpy] = 0
        buf_prev.append([mpx, mpy])
        cnt += 1

    while cnt < num and cnt > 0:
        buf = []
        for idx in buf_prev:
            val_df = df[idx[0]][idx[1]]
            for didx in neighbors:
                ii = idx[0] + didx[0]
                jj = idx[1] + didx[1]
                if 0<=ii and ii<nelx and 0<=jj and jj<nely:
                    # print df[ii][jj]
                    if df[ii][jj] == infinity:
                        df[ii][jj] = val_df + 1
                        max_val = max(df[ii][jj], max_val)
                        buf.append([ii, jj])
                        cnt += 1
        buf_prev = list(buf)

    # print max_val

    # slope = 64
    # cutoff = 0.1
    # tr_min = transfer(0, slope, cutoff)
    # tr_max = transfer(1, slope, cutoff)
    # max_val *= 1.0
    # for i in xrange(0, nelx):
    #     for j in xrange(0, nely):
    #         df[i][j] /= max_val
    #         df[i][j] = max(epsilon, df[i][j])
    #         tr_df = transfer(df[i][j], slope, cutoff)
    #         df[i][j] = (tr_df - tr_min) / (tr_max - tr_min)

    return df

if __name__ == "__main__":
    if len(argv) < 4:
        print 'usage: ./gen_design.py <path_to_origiinal_design> <path_to_favored_design> <path_to_disfavored_design>\n\t* use None as default'
        quit()

    original = json.loads(open(argv[1], 'r').read())
    favored = json.loads(open(argv[2], 'r').read())['design'] if argv[2] != 'None' else None
    disfavored = json.loads(open(argv[3], 'r').read())['design'] if argv[3] != 'None' else None

    resolution = int(argv[4]) if len(argv) > 4 else RESOLUTION
    material = float(argv[5]) if len(argv) > 5 else AMNTMAT

    # print original, favored, disfavored, resolution, material
    gen_design(original, favored, disfavored, resolution, material)

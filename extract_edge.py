#!/usr/bin/env python

##########################################################################
#
#   extract edges from thinned binary image (skeleton)
#
##########################################################################
from sys import argv
from PIL import Image
from math import sqrt
from random import random, seed, shuffle

NEIGHBORRADIUS = 3
ISOLATIONSIZE = 3
SPLITWINDOW = 3
SPLITCOS = 0.5
TOSPLITEDGE = True
NORMALWINDOW = 2
EPS = 1e-6

def sign(x):
    return 0 if x == 0 else (1 if x > 0 else -1);

def clamp(v, vmin, vmax):
    v = max(vmin, v)
    v = min(v, vmax)
    return v

def find_neighbor(skel, i, j, w, h, r):
    for di in xrange(-r, r+1):
        for dj in xrange(-r, r+1):
            ii = clamp(i+di, 0, h-1)
            jj = clamp(j+dj, 0, w-1)
            if ii==i and jj==j:
                continue
            if skel[ii][jj] > 0:
                clear_neighbors(skel, i, j, w, h, r)
                return ii, jj
    return -1, -1

def clear_neighbors(skel, i, j, w, h, r):
    for di in xrange(-r, r+1):
        for dj in xrange(-r, r+1):
            ii = clamp(i+di, 0, h-1)
            jj = clamp(j+dj, 0, w-1)
            skel[ii][jj] = 0

def find_edge(skel, i, j, w, h):
    edge = [(i, j)]
    while True:
        ii, jj = find_neighbor(skel, i, j, w, h, NEIGHBORRADIUS)
        if ii >= 0 and jj >= 0:
            edge.append((ii, jj))
            skel[i][j] = 0
            i = ii
            j = jj
        else:
            break
    return edge

def split(edge):
    edges = []
    last_start = 0
    for idx in xrange(SPLITWINDOW, len(edge)-SPLITWINDOW):
        i0, j0 = edge[idx - SPLITWINDOW]
        i, j = edge[idx]
        i1, j1 = edge[idx + SPLITWINDOW]
        x0, y0 = i0-i, j0-j
        x1, y1 = i1-i, j1-j
        cos_angle = (x0*x1 + y0*y1) / (sqrt(x0**2+y0**2) * sqrt(x1**2+y1**2))
        # print cos_angle
        if abs(cos_angle) < SPLITCOS:
            edges.append(edge[last_start: idx + 1])
            last_start = idx
    edges.append(edge[last_start:])
    return edges

def get_rand_rgb(s):
    seed(s)
    return int(int(random() * 1024) % 97 * 255 / 100)

def compute_normal(p1, p2):
    vi, vj = p1[0]-p2[0], p1[1]-p2[1]
    di, dj = vj, -vi
    norm = sqrt(di**2 + dj**2)
    return di/norm, dj/norm

def write_to_image(edges, w, h):
    shuffle(edges)
    pixels = []
    for i in xrange(0, h):
        for j in xrange(0, w):
            pixels.append((255, 255, 255))

    for edge in edges:
        # print len(edge)
        idx = edges.index(edge)
        r = get_rand_rgb(idx)
        g = get_rand_rgb(255 - r + idx)
        b = get_rand_rgb(255 - g + r * idx)
        for i, j in edge:
            pixels[i * w + j] = (r, g, b)

    img = Image.new('RGB', (w, h))
    img.putdata(pixels)
    img = img.resize((w*8, h*8))
    img.save('edges.bmp')


if __name__ == "__main__":
    if len(argv) < 3:
        print 'usage: ./extract_edge <path_to_input_skeleton> <path_to_reference_image>'
        edge = [(0, 0), (3, 1), (4, 4)]
        print split(edge)
        exit()

    #
    # extracting edges (w/o thickness)
    #
    str_skel_data = open(argv[1], 'r').read()
    skel_data = str_skel_data.split('\n')
    skel = []

    for row_str in skel_data:
        row_str_arr = row_str.split(',')
        skel.append([float(x) for x in row_str_arr])

    h = len(skel)
    w = len(skel[0])
    edges = []
    for i in xrange(0, h):
        for j in xrange(0, w):
            if skel[i][j] <= 0:
                continue

            edge = find_edge(skel, i, j, w, h)

            if TOSPLITEDGE:
                split_edges = split(edge)
                for edge in split_edges:
                    if len(edge) > ISOLATIONSIZE:
                        edges.append(edge)
            else:
                if len(edge) > ISOLATIONSIZE:
                    edges.append(edge)

    print 'totol num of edges: ', len(edges)

    #
    # retrieve thickness for each edge
    #
    # str_voxels_data = open(argv[2], 'r').read()
    img_voxels = Image.open(argv[2])
    # voxels_data = str_voxels_data.split('\n')
    voxels_data = list(img_voxels.getdata())
    # voxels_data.reverse()
    voxels = []

    for i in xrange(0, h):
        row = []
        for j in xrange(0, w):
            voxel_value = 0 if voxels_data[i * w + j] == 255 else 1
            row.append(voxel_value)
        voxels.append(row)

    # print voxels

    # for row_str in voxels_data:
    #     row_str_arr = row_str.split(',')
    #     voxels.append([float(x) for x in row_str_arr])
    #
    if h != len(voxels) or w != len(voxels[0]):
        print 'error: .skeleton and .vxg dimension mismatch!'
        exit()

    thicknesses = []
    for edge in edges:
        thickness = []
        for idx in xrange(0, len(edge)):
            # compute its normal
            i0 = clamp(idx - NORMALWINDOW, 0, len(edge)-1)
            i1 = clamp(idx + NORMALWINDOW, 0, len(edge)-1)
            di, dj = compute_normal(edge[i0], edge[i1])
            di, dj = (1, (dj+EPS)/(di+EPS)) if abs(dj) < abs(di) else ((di+EPS)/(dj+EPS), 1)

            # retrieve num of voxels along the normal
            t = 1
            radii = [1, 1]
            for s in xrange(-1, 3, 2):
                i, j = edge[idx]
                si, sj = sign(di), sign(dj)
                while True:
                    ii, jj = clamp(int(i + s * di), 0, h-1), clamp(int(j + s * dj), 0, w-1)
                    if ii == i and jj == j:
                        break
                    if voxels[ii][jj] > 0.5 or voxels[clamp(ii+si, 0, h-1)][jj] > 0.5 or voxels[ii][clamp(jj+sj, 0, w-1)] > 0.5:
                        radii[(s + 1) / 2] += 1
                        i, j = ii, jj
                    else:
                        break

            thres_bal = 3
            bal = radii[0] / radii[1]
            if bal < 1/thres_bal or bal > thres_bal:
                t += min(radii[0], radii[1]) * (thres_bal + 1) / 2
            else:
                t += (radii[0] + radii[1]) / 2

            thickness.append(t)

            # visualization, must remove when not needed
            print idx, ':', t
            for s in xrange(-1, 3, 2):
                i, j = edge[idx]
                for tt in xrange(1, t):
                    ii, jj = clamp(int(i + s * tt * di), 0, h-1), clamp(int(j + s * tt * dj), 0, w-1)
                    edge.append((ii, jj))

        thicknesses.append(thickness)

    # output an image for debugging
    write_to_image(edges, w, h)

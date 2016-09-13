#!/usr/bin/env python

##########################################################################
#
#   use marching cubes to extract geometry from voxel grid data
#
##########################################################################

from sys import argv
import numpy as np
import mcubes

def get_distance_field(vxg, nelx, nely):
    infinity = 1e6
    epsilon = 1e-6
    df = []

    # initialize distance field
    buf_prev = []
    cnt = 0
    for i in xrange(0, nelx):
        row = []
        for j in xrange(0, nely):
            if vxg[i, j] == 1:
                row.append(0)
                buf_prev.append([i, j])
                cnt += 1
            else:
                row.append(infinity)
        df.append(row)

    num = nelx * nely
    max_val = 0
    neighbors = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]

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

    nelz = 5
    np_df = np.ndarray(shape=(nelx, nely, nelz), dtype=int, order='F')

    for i in xrange(0, nelx):
        # print ' '.join([format(x, '1.1f') for x in df[i]])
        for j in xrange(0, nely):
            # r = nelz/2
            # dfs = [int(df[i][j]) + r]
            # for k in xrange(0, r):
            #     dfs = [int(df[i][j]) + r - k - 1] + dfs + [int(df[i][j]) + r - k - 1]
            # np_df[i, j] = dfs
            np_df[i, j] = [int(df[i][j]) + 1, int(df[i][j]), int(df[i][j]), int(df[i][j]), int(df[i][j])+1]
    print np_df

    return np_df

# Create a data volume (30 x 30 x 30)
# X, Y, Z = np.mgrid[:30, :30, :30]
# u = (X-15)**2 + (Y-15)**2 + (Z-15)**2 - 8**2
#
# for i in xrange(0, 30):
#     for j in xrange(0, 30):
#         print u[i, j, 0]

# Extract the 0-isosurface

# vxg_path = '../forte_1473283630_64_0.074_optimized.vxg'


#
#   main entrance
#
if __name__ == "__main__":
    if len(argv) < 2:
        print 'usage: /marching_cube.py <path_to_vxg_file>'
        quit()

    vxg_path = argv[1]
    str_vxg = open(vxg_path, 'r').read()
    rows_vxg = str_vxg.split('\n')

    m = len(rows_vxg)
    n = len(rows_vxg[0].split(','))
    vxg = np.ndarray(shape=(m, n), dtype=float, order='F')
    for i in xrange(0, m):
        row_vxg = rows_vxg[i].split(',')
        for j in xrange(0, n):
            vxg[i, j] = 0 if float(row_vxg[j]) <= 0.01 else 1

    df = get_distance_field(vxg, m, n)

    vertices, triangles = mcubes.marching_cubes(df, 0)

    # Export the result to sphere.dae
    mcubes.export_mesh(vertices, triangles, "vxg.dae", "MyVXG")

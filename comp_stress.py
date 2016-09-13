#!/usr/bin/env python

##########################################################################
#
#   offline testing of stress computing
#
##########################################################################

from numpy import ndarray, matrix, identity, linalg, array, hstack
from copy import copy

def comp_green_strain(v1, v2, v3, V1, V2, V3):
    U = matrix([v1, v2, v3])
    W = matrix([V1, V2, V3])
    F = W * U.getI()
    E = 0.5 * (F.getH() * F - identity(3))
    return E

def comp_tetra_stress(positions, displacements):
    node = copy(positions[0])
    node1 = copy(positions[1])
    node2 = copy(positions[2])
    node3 = copy(positions[3])

    v1 = [x - y for x, y in zip(node1, node)]
    v2 = [x - y for x, y in zip(node2, node)]
    v3 = [x - y for x, y in zip(node3, node)]

    node = [x + y for x, y in zip(node, displacements[0])]
    node1 = [x + y for x, y in zip(node1, displacements[1])]
    node2 = [x + y for x, y in zip(node2, displacements[2])]
    node3 = [x + y for x, y in zip(node3, displacements[3])]

    V1 = [x - y for x, y in zip(node1, node)]
    V2 = [x - y for x, y in zip(node2, node)]
    V3 = [x - y for x, y in zip(node3, node)]

    E = comp_green_strain(v1, v2, v3, V1, V2, V3)
    return linalg.norm(E, 'fro')

def node_nums_3d(nelx, nely, nelz, mpx, mpy, mpz):
    innback = array([0, 1, nely + 1, nely + 2]) #  initial node numbers at back
    enback = nely * (mpx - 1) + mpy
    nnback = innback + enback + mpx - 1
    nnfront = nnback + (nelx + 1) * (nely + 1)
    nn = hstack((nnback, nnfront[::-1])) + (mpz - 1) * (nelx + 1) * (nely + 1)
    return nn

# def comp_stress(disp_str, nelx, nely, nelz, vxg):
def comp_stress(disp_path, vxg_path):
    str_vxg = open(vxg_path).read()
    rows_vxg = str_vxg.split('\n')
    nely = len(rows_vxg)
    nelx = len(rows_vxg[0].split(','))
    nelz = 1

    vxg = []
    for i in xrange(0, nely):
        row_vxg = rows_vxg[i].split(',')
        vxg.append([float(x) for x in row_vxg])
    print nelx, nely

    disp_str = open(disp_path, 'r').read()

    arrDisp = disp_str.split(',')
    tetraGrid = []
    stressData = []
    p = 3

    stress_elms = []
    # max_stress = 0
    for i in xrange(0, nelx):
        stress_elms_yz = []
        for j in xrange(0, nely):
            stress_elms_z = []
            for k in xrange(0, nelz):
                ns = node_nums_3d(nelx, nely, nelz, i+1, j+1, k+1)
                tetras = []

                # the compositions of tetrahedrons of a cube
                tetraIndices = [
					[7, 0, 5, 6],
					[0, 1, 6, 4],
					[0, 6, 4, 5],
					[2, 0, 3, 5],
					[0, 1, 4, 3],
					[0, 3, 4, 5]
				]

                # init the tetrahedral data structure
                elm_max_stress = 0
                for h in xrange(0, len(tetraIndices)):
                    idxTetra = tetraIndices[h]
                    idxNodes = [ns[idxTetra[0]] - 1, ns[idxTetra[1]] - 1, ns[idxTetra[2]] - 1, ns[idxTetra[3]] - 1]

                    positions = []
                    displacements = []

                    for l in xrange(0, len(idxNodes)):
                        idx = idxNodes[l]
                        displacements.append([float(arrDisp[idx * 3]), float(
							arrDisp[idx * 3 + 1]), float(arrDisp[idx * 3 + 2])])

                        z = int(idx / (nelx + 1) / (nely + 1))
                        x = int((idx - z * (nelx + 1) * (nely + 1)) / (nely + 1))
                        y = nely - int(idx - z * (nelx + 1) * (nely + 1) - x * (
                            nely + 1))

                        positions.append([x, y, z])

                    xe = vxg[j][i] # density at this voxel
                    stress = comp_tetra_stress(positions, displacements) * pow(xe, p)

                    elm_max_stress = max(elm_max_stress, stress)
                    # max_stress = max(max_stress, stress)
                    stressData.append(stress)

                stress_elms_z.append(elm_max_stress)
            stress_elms_yz.append(stress_elms_z)
        stress_elms.append(stress_elms_yz)

    print 'avg stress', mean(stressData)
    print 'std stress', pstdev(stressData)
    max_stress = max(stressData)
    print 'max stress', max_stress

    for i in xrange(0, nelx):
        for j in xrange(0, nely):
            for k in xrange(0, nelz):
                stress_elms[i][j][k] /= (max_stress * 0.5)

    print 'stress computed'

    return stress_elms

def mean(data):
    """Return the sample arithmetic mean of data."""
    n = len(data)
    if n < 1:
        raise ValueError('mean requires at least one data point')
    return sum(data)/n # in Python 2 use sum(data)/float(n)

def _ss(data):
    """Return sum of square deviations of sequence data."""
    c = mean(data)
    ss = sum((x-c)**2 for x in data)
    return ss

def pstdev(data):
    """Calculates the population standard deviation."""
    n = len(data)
    if n < 2:
        raise ValueError('variance requires at least two data points')
    ss = _ss(data)
    pvar = ss/n # the population variance
    return pvar**0.5

if __name__ == "__main__":
    vxg_path = 'forte_1473444030_64_0.113_analyzed.vxg'
    disp_path = 'forte_1473444030_64_0.113_analyzed.disp'

    comp_stress(disp_path, vxg_path)
    # comp_stress(disp_str, n, m, 1, vxg)
    # print disp_str

#!/usr/bin/env python

##########################################################################
#
#   iterative topology optimization
#
##########################################################################

from sys import argv
from skeletonize import vxgs_to_edges, clamp
import json

def get_sqr_nbgh(x, y, r, w, h):
    bounds = [[x-r, y-r], [x-r, y-r], [x-r, y+r], [x-r, y+r], [x+r, y-r], [x+r, y-r], [x+r, y+r], [x+r, y+r]]
    for i in xrange(0, len(bounds)):
        bounds[i][0] = clamp(bounds[i][0], 0, w-1)
        bounds[i][1] = clamp(bounds[i][1], 0, h-1)
    return bounds

if __name__ == "__main__":
    if len(argv) < 4:
        print 'usage: ./itropt.py <path_to_design> <path_to_optimization_data> <problem_name>'
        quit()

    path_design = argv[1]
    path_opt = argv[2]
    probname = argv[3]

    # find edges
    design_file = open(path_design, 'r')
    design_obj = json.loads(design_file.read())
    edges, thicknesses, w, h = vxgs_to_edges(path_opt, probname, design_obj)
    design_file.close()

    # identify nodes and their neighborhoods
    r = 1
    empty_nodes = []
    for edge in edges:
        empty_node1 = get_sqr_nbgh(edge[0][1], edge[0][0], r, w, h)
        empty_node2 = get_sqr_nbgh(edge[-1][1], edge[-1][0], r, w, h)
        empty_nodes += [empty_node1, empty_node2]

    print empty_nodes

    # append to clearance
    if 'clearances' in design_obj:
        design_obj['clearances'] += empty_nodes

    design_file = open(path_design, 'w')
    design_file.write(json.dumps(design_obj))
    design_file.close()

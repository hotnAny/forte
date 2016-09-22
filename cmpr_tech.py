#!/usr/bin/env python

##########################################################################
#
#   compare results and stress of different techniques
#
##########################################################################
import sys
sys.path.append('py/')
from topy_api import gen_tpd, optimize
from comp_stress import comp_stress
import subprocess
import json
import random

def evaluate(design, res, mat, grad, out_path):
    tpd, debug_voxelgrid = gen_tpd(design, res, mat)
    print ''.join(debug_voxelgrid)[::-1]
    probname = optimize(tpd, grad)

    disp_path = probname + '_optimized.disp'
    vxg_path = probname + '_optimized.vxg'
    stress_elms, mean_stress, high_stress, max_stress = comp_stress(disp_path, vxg_path, True)

    out_path += '_' + probname
    subprocess.call('echo mean_stress: ' + str(mean_stress) + ' high_stress: ' + str(high_stress) + ' max_stress: ' + str(max_stress) + ' > ' + probname + '_stress.txt', shell=True)
    subprocess.call('mkdir ' + out_path, shell=True)
    subprocess.call('mv ' + probname + '* ' + out_path, shell=True)

def mod_expand(designObj, mat_gain):
    design = designObj['design']
    for edge in design:
        thickness = edge['thickness']
        fav_vals = edge['favVals']
        for i in xrange(0, len(thickness)-1):
            thickness[i] *= mat_gain
            fav_vals[i] = 0.99
    designObj['design'] = design
    return designObj

def mod_ignore(designObj):
    designObj['ignore'] = True
    return designObj

if __name__ == "__main__":
    # print 'usage: ./cmpr_tech.py <resolution> <amount_of_material>'

    resolution = 128
    material = 1
    gradient = 0.1

    exp_dir = 'exp_data/'
    forte_dir = 'example_data/'
    forte_files = ['test1419.forte']

    for f in forte_files:
        # design = json.loads(open(forte_dir + f, 'r').read())
        # design = mod_expand(design, material)
        # evaluate(design, resolution, material, 0.01, exp_dir + f + '_expand_sketch')

        # design = json.loads(open(forte_dir + f, 'r').read())
        # evaluate(design, resolution, material, gradient, exp_dir + f + '_combine_sketch')

        design = json.loads(open(forte_dir + f, 'r').read())
        design = mod_ignore(design)
        evaluate(design, resolution, material, gradient, exp_dir + f + '_ignore_sketch')

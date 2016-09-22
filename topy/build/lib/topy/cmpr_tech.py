#!/usr/bin/env python

##########################################################################
#
#   compare results and stress of different techniques
#
##########################################################################

from topy_api import gen_tpd, optimize
from comp_stress import comp_stress
import subprocess
import json
import random

def evaluate(in_path, res, mat, mat_gain, grad, out_path):
    out_path += str(random.random())
    design = json.loads(open(in_path, 'r').read())
    tpd, debug_voxelgrid = gen_tpd(design, res, mat)
    print ''.join(debug_voxelgrid)[::-1]
    probname = optimize(tpd, grad)

    disp_path = probname + '_optimized.disp'
    vxg_path = probname + '_optimized.vxg'
    stress_elms, mean_stress, high_stress, max_stress = comp_stress(disp_path, vxg_path, True)

    subprocess.call('echo mean_stress: ' + str(mean_stress) + ' high_stress: ' + str(high_stress) + ' max_stress' + str(max_stress) + ' > ' + probname + '_stress.txt', shell=True)
    subprocess.call('mkdir ' + out_path, shell=True)
    subprocess.call('mv ' + probname + '* ' + out_path, shell=True)

if __name__ == "__main__":
    # print 'usage: ./cmpr_tech.py <resolution> <amount_of_material>'

    resolution = 64
    material = 2
    gradient = 0.1

    exp_dir = 'exp_data/'
    forte_dir = 'example_data/'
    forte_tuples = [('test', 'test1346.forte', 'test1400.forte', 'test1419.forte')]

    for _tuple in forte_tuples:
        name, expand_sketch, ignore_sketch, combine_sketch = _tuple
        forte_path = forte_dir

        evaluate(forte_dir + expand_sketch, resolution, material, material, 0.001, exp_dir + name + '_expand_sketch')
        evaluate(forte_dir + ignore_sketch, resolution, material, 1, gradient, exp_dir + name + '_ignore_sketch')
        evaluate(forte_dir + combine_sketch, resolution, material, 1, gradient, exp_dir + name + '_combine_sketch')

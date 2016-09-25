#!/usr/bin/env python

##########################################################################
#
#   compare results and stress of different techniques
#
#   TODO:
#       - write to a log file about progress
#
##########################################################################

import sys
sys.path.append('py/')
from topy_api import gen_tpd, optimize
from comp_stress import comp_stress
import subprocess
import json
import random
import time

#
#   evaluating a technique by performing topopt and stress analysis
#
def evaluate(design, res, mat, grad, out_path):
    tpd, debug_voxelgrid = gen_tpd(design, res, mat)
    print ''.join(debug_voxelgrid)[::-1]
    probname = optimize(tpd, grad)

    disp_path = probname + '_optimized.disp'
    vxg_path = probname + '_optimized.vxg'
    stress_elms, mean_stress, high_stress, max_stress, perc_mat, perc_mat_actu = comp_stress(disp_path, vxg_path, True)

    subprocess.call('echo mean_stress: ' + str(mean_stress) + ' high_stress: ' + str(high_stress) + ' max_stress: ' + str(max_stress) + ' %material: ' + str(perc_mat) + '%material actual: ' + str(perc_mat_actu) + ' > ' + probname + '_stress.txt', shell=True)
    subprocess.call('mkdir ' + out_path, shell=True)
    subprocess.call('mv ' + probname + '* ' + out_path, shell=True)

    return mean_stress, high_stress, max_stress, perc_mat, perc_mat_actu

#
#   modify design object for the 'expand' technique
#
def mod_combine(designObj, base_mat):
    design = designObj['design']
    for edge in design:
        thickness = edge['thickness']
        fav_vals = edge['favVals']
        for i in xrange(0, len(thickness)-1):
            # thickness[i] *= mat_gain
            fav_vals[i] = 0.99
    designObj['design'] = design
    designObj['base_mat'] = base_mat
    return designObj

#
#   modify design object for the 'combine' technique
#
def mod_expand(designObj, mat_gain):
    design = designObj['design']
    for edge in design:
        thickness = edge['thickness']
        fav_vals = edge['favVals']
        for i in xrange(0, len(thickness)-1):
            thickness[i] *= mat_gain
            fav_vals[i] = 1
    designObj['design'] = design
    designObj['expand'] = True
    return designObj

#
#   modify design object for the 'ignore' technique
#
def mod_ignore(designObj, base_mat):
    designObj['ignore'] = True
    designObj['base_mat'] = base_mat
    return designObj

if __name__ == "__main__":
    # print 'usage: ./cmpr_tech.py <resolution> <amount_of_material>'
    resolution = 128
    materials = [1 + x * 0.5 for x in xrange(0, 8)]
    gradients = [0.1 * x for x in xrange(1, 11)]

    _uid = str(int(random.random() * 1e6 % 1e3))

    exp_dir = 'exp_data/'
    forte_dir = 'example_data/'
    forte_files = ['test1419.forte']

    for m in materials:
        print 'amount of material: ', m
        results = []
        uid = _uid + '_m' + str(m)
        for f in forte_files:
            design = json.loads(open(forte_dir + f, 'r').read())
            design = mod_expand(design, m)
            results.append(evaluate(design, resolution, m, 0.01, exp_dir + uid + '_' + f + '_expand_' + time.strftime("%m%d_%H%M%S")))

            # the amount of material used in the baseline case
            base_mat = results[0][3]

            design = json.loads(open(forte_dir + f, 'r').read())
            design = mod_combine(design, base_mat)
            for g in gradients:
                results.append(evaluate(design, resolution, m, g, exp_dir + uid + '_' + 'g' + format(g, '1.2f') + f + '_combine_' + time.strftime("%m%d_%H%M%S")))

            design = json.loads(open(forte_dir + f, 'r').read())
            design = mod_ignore(design, base_mat)
            results.append(evaluate(design, resolution, m, 0.01, exp_dir + uid + '_' + f + '_ignore_' + time.strftime("%m%d_%H%M%S")))

        print ('mean', 'high', 'max', '% mat', '% mat actu')
        for result in results:
            print result

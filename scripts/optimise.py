#!/usr/bin/env python

# Author: William Hunter
# This script handles both number of iterations and change stop criteria runs

#
#   this version has been modified by
#   Xiang 'Anthony' Chen, xiangchen@acm.org
#   Summer 2016
#

# Import required modules:
from sys import argv

from time import time

from numpy import array, zeros, take, put

from matplotlib import pyplot as pp

import topy

import subprocess

from comp_stress import comp_stress

# XAC
import numpy

def write_to_file_1d(list, fname):
    str_data = ','.join(format(x, '3.3f') for x in list)
    f = open(fname, 'w')
    f.write(str_data)
    f.close()

def write_to_file_3d(list, fname):
    str_data = ''
    for xy_slice in list:
        for y_slice in xy_slice:
            str_data += (','.join(format(x, '3.3f') for x in y_slice) + '\n')
        str_data += '\n'
    str_data = str_data[:-2] # remove the last two \n to avoid confusion in segmentation

    f = open(fname, 'w')
    f.write(str_data)
    f.close()

# Optimising function:
def optimise(t, query_type):
    t.fea()

    global QUERY_ANALYZE
    if query_type == QUERY_OPTIMIZE:
        t.sens_analysis()
        t.filter_sens_sigmund()
        t.update_desvars_oc()
        # Below this line we print and create images:
        # print '[xac] NOT creating output images ...'
        if t.nelz:
            # remove previous output
            subprocess.call('rm ' + t.probname + '*.vtk', shell=True)
            topy.create_3d_geom(t.desvars, prefix=t.probname, \
            iternum=t.itercount, time='none')
        else:
            topy.create_2d_imag(t.desvars, prefix=t.probname, \
            iternum=t.itercount, time='none')
        print '%4i  | %3.6e | %3.3f | %3.4e | %3.3f | %3.3f |  %1.3f  |  %3.3f '\
        % (t.itercount, t.objfval, t.desvars.sum()/(t.nelx * t.nely * t.nelz), \
        t.change, t.p, t.q, t.eta.mean(), t.svtfrac)
        # Build a list of average etas:
        global etas_avg
        etas_avg.append(t.eta.mean())

    global is_itr0
    if is_itr0:
        disp_path = t.probname + '_analyzed.disp'
        write_to_file_1d(t.d, disp_path)
        vxg_path = t.probname + '_analyzed.vxg'
        write_to_file_3d(t.desvars, vxg_path)
        t.stress = comp_stress(disp_path, vxg_path)
        is_itr0 = False

# XAC
def main(argv):
    # [xac] query type
    global QUERY_ANALYZE
    QUERY_ANALYZE = 0
    global QUERY_OPTIMIZE
    QUERY_OPTIMIZE = 1

    # [xac] copied & pasted from topy
    SOLID, VOID = 1.000, 0.001 #  Upper and lower bound value for design variables

    query_type = QUERY_ANALYZE if len(argv) < 3 else int(argv[2])
    print '[xac] query type: ', 'analysis' if query_type == QUERY_ANALYZE else 'optimize'

    # Set up ToPy:
    print '[xac] setting up topy ...'
    t = topy.Topology()
    t.query_type = query_type;
    print '[xac] loading topy tpd ...'
    t.load_tpd_file(argv[1])
    print '[xac] setting up parameters ...'
    t.set_top_params()

    t.cutoff = 0.1 if len(argv) < 4 else argv[3]
    print '[xac] cutoff is ', t.cutoff

    # [xac] for query, mark non-design elements as void
    if query_type == QUERY_ANALYZE:
        t.desvars = zeros((t.nelz, t.nely, t.nelx)) + VOID # reset densities to zeros

        # set only actv_elems to 1
        dims = t.desvars.shape
        flatx = t.desvars.flatten()
        idx = []
        z, y, x = dims
        for i in range(z):
            for j in range(x):
                for k in range(y):
                    idx.append(k*x + j + i*x*y)

        if t.actv.any():
            actv = take(idx, t.actv)
            put(flatx, actv, SOLID)
        t.desvars = flatx.reshape(dims)

    # custom weight penalty
    t.WEIGHTEDPENALTY = False

    print '[xac] finished setup'

    # Create empty list for later use:
    global etas_avg
    etas_avg = []

    # [xac] DEBUG: for compare displacements before/after optimization
    global is_itr0
    is_itr0 = True

    # Create (plot) initial design domain:
    if t.nelz:
        #create_3d_geom(t.desvars, prefix=t.probname, iternum=0, time='none')
        nelz = t.nelz
    else:
        #create_2d_imag(t.desvars, prefix=t.probname, iternum=0, time='none')
        nelz = 1 #  else we divide by zero

    # Start optimisation runs, create rest of design domains:
    print '%5s | %11s | %5s | %10s | %5s | %5s | %7s | %5s ' % ('Iter', \
    'Obj. func.  ', 'Vol. ', 'Change    ', 'P_FAC', 'Q_FAC', 'Ave ETA', 'S-V frac.')
    print '-' * 79
    ti = time()

    # Try CHG_STOP criteria, if not defined (error), use NUM_ITER for iterations:
    try:
        # HACK fix the temp threshold
        i = 0;
        while t.change > 0.001 and i < t.numiter: # t.chgstop:
            optimise(t, query_type)
            i += 1
            # [xac] early exit for analysis
            if query_type == QUERY_ANALYZE:
                break
        print '[xac] used CHG_STOP'
    except AttributeError:
        for i in range(t.numiter):
            optimise(t, query_type)
            # [xac] early exit for analysis
            if query_type == QUERY_ANALYZE:
                break
        print '[xac] used NUM_ITER'
    te = time()

    ######################################################
    # [xac] WRITING THE FINAL RESULT TO A TEXT FILE

    if query_type == QUERY_OPTIMIZE:
        write_to_file_1d(t.d, t.probname + '_optimized.disp')
        write_to_file_3d(t.desvars, t.probname + '_optimized.vxg')

    ######################################################

    try:
        # Print solid-void ratio info:
        print '\nSolid plus void to total elements fraction = %3.5f' % (t.svtfrac)
        # Print iteration info:
        print t.itercount, 'iterations took %3.3f minutes (%3.3f min/iter. \
        or %3.3f sec/iter.)'\
        %((te - ti) / 60, (te - ti) / 60 / t.itercount, (te - ti) / t.itercount)
        print 'Average of all ETA\'s = %3.3f (average of all a\'s = %3.3f)' \
        % (array(etas_avg).mean(), 1/array(etas_avg).mean() - 1)
    except:
        print 'logging error'

    return t.probname

if __name__ == "__main__":
    main(argv)

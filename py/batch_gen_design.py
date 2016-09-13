#!/usr/bin/env python

##########################################################################
#
#   batch generating designs using topology optimization with user prefs.
#       * save multiple delta files (one single big json doesn't work well)
#
##########################################################################
from sys import argv
import json
import datetime
import subprocess

from gen_design import gen_design
from get_delta import get_delta

RESOLUTION = 128
AMNTMAT = 2
EXHAUSTALL = False

if __name__ == "__main__":
    print 'usage: ./batch_gen_design.py <path_to_origiinal_design> <path_to_design_deltas> <resolution> <amount_of_material> <output_path>'
    original = json.loads(open(argv[1], 'r').read())
    deltas = json.loads(open(argv[2], 'r').read())['design']
    resolution = int(argv[3]) if len(argv) > 4 else RESOLUTION
    material = float(argv[4]) if len(argv) > 5 else AMNTMAT
    output_path = argv[5]

    log_file = open(output_path + '/log.txt', 'w')

    if EXHAUSTALL:
        dispatch_list = [[]]
        for i in xrange(0, len(deltas)):
            dispatch_list_new = []
            for subset_list in dispatch_list:
                dispatch_list_new.append(subset_list + [True])
                dispatch_list_new.append(subset_list + [False])
            dispatch_list = list(dispatch_list_new)

        for subset_list in dispatch_list:
            log_file = open(output_path + '/log.txt', 'a')
            log_file.write('-------------------------------------------------------------------\n')
            log_file.write('#' + str(dispatch_list.index(subset_list)) + ' started at ' + str(datetime.datetime.now()) + '\n')
            log_file.close()

            print subset_list
            sub_deltas = []
            for idx in xrange(0, len(deltas)):
                if subset_list[idx] == True:
                    sub_deltas.append(deltas[idx])

            probname = gen_design(original, None, sub_deltas, resolution, material)
            fname = output_path + '/' + str(dispatch_list.index(subset_list)) + '.delta'
            print fname
            get_delta('./', probname, original, fname)
            subprocess.call('rm ' + probname + '*', shell=True)

            log_file = open(output_path + '/log.txt', 'a')
            log_file.write('finished at ' + str(datetime.datetime.now()) + '\n')
            log_file.close()
    else:
        for edge in deltas:
            probname = gen_design(original, [edge], None, resolution, material)
            fname = output_path + '/' + str(deltas.index(edge)) + '.delta'
            print fname
            get_delta('./', probname, original, fname)
            subprocess.call('rm ' + probname + '*', shell=True)

            log_file = open(output_path + '/log.txt', 'a')
            log_file.write('finished at ' + str(datetime.datetime.now()) + '\n')
            log_file.close()

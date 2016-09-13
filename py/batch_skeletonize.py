#!/usr/bin/env python

##########################################################################
#
#   doing skeletonize.py in batch
#
##########################################################################
from sys import argv
from os import listdir
from os.path import isfile, join
from skeletonize import skeletonize

# chair 0.6385
# hook 0.5353125
# stepstool 0.54225

if __name__ == "__main__":
    if(len(argv) < 5):
        quit()

    raw_path = argv[1]
    prefix = argv[2]
    design_path = argv[3]
    dim_voxel = float(argv[4])      # HACK

    design_obj = open(design_path, 'r').read()
    fds_path = open(design_path + '.fds', 'w')
    fds_path.write(design_obj)
    fds_path.close()

    raw_dirs = [d for d in listdir(raw_path) if isfile(join(raw_path, d)) == False and d.startswith(prefix)]
    # print raw_dirs

    cnt = 0
    for d in raw_dirs:
        ins_path = join(raw_path, d)
        probname = None
        for f in listdir(ins_path):
            if f.endswith('vxg'):
                probname = f[0: f.rfind('_')]
                break

        if probname != None:
            print probname
            skeletonize(dim_voxel, ins_path, probname, design_path + '.fds')

        # cnt += 1
        # if cnt >= 8:
        #     break

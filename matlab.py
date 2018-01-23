#!/usr/bin/env python

import sys
from sys import argv
import os
import subprocess

MCRPATH = '/Applications/MATLAB/MATLAB_Runtime/v91'
LIBPATH = '.:' + MCRPATH + '/runtime/maci64'
LIBPATH = LIBPATH + ':' + MCRPATH + '/bin/maci64'
LIBPATH = LIBPATH + ':' + MCRPATH + '/sys/os/maci64'
TOP88PATH = './topopt.app/Contents/MacOS/topopt'

if __name__ == "__main__":
    if len(argv) != 2:
    	print 'usage: ./matlab.py <input_file_path>'
    	quit()
    
    os.environ['DYLD_LIBRARY_PATH'] = LIBPATH
    matinput_path = os.getcwd() + '/' + argv[1]
    subprocess.call('rm ' + matinput_path, shell=True)
    print 'starting topopt service ...'
    subprocess.check_call([TOP88PATH, matinput_path],\
        env=dict(os.environ, SQSUB_VAR="visible in this subprocess"))
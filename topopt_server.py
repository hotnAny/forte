#!/usr/bin/env python

##########################################################################
#
#   server for writting input to top88, v0.1
#
#   by xiangchen@acm.org, 05/2017
#
##########################################################################

from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from urlparse import urlparse, parse_qs
import sys
from sys import argv
import os
import time
import subprocess
import json
import traceback
from numpy import array, hstack, empty
from math import sqrt

# default input file path/name
INPUTFILE = '~matinput'

#
#   for execution time measurement
#
T = int(round(time.time() * 1000))
def _log(msg):
    global T
    t = int(round(time.time() * 1000))
    if msg != None:
        print msg + ': ' + str(t - T) + 'ms'
    T = t
    return t

#
#   get element number
#
def elm_num_2d(nelx, nely, mpx, mpy):
    return nely * (mpx - 1) + mpy
#
#   get 2d node number
#
def node_nums_2d(nelx, nely, mpx, mpy):
    inn = array([0, 1, nely + 1, nely + 2]) #  initial node numbers
    en = nely * (mpx - 1) + mpy #  element number
    nn = inn + en + mpx - 1 #  node numbers
    return nn

#
#   safely retrieve key-value from object
#
def safe_retrieve_one(buffer, key, alt):
    return buffer[key][0] if key in buffer and len(buffer[key]) > 0 else alt

def safe_retrieve_all(buffer, key, alt):
    return buffer[key] if key in buffer else alt

#
#   processing incoming data
#
def proc_post_data(post_data, res=48, amnt=1.0, sdir=None):
    _log(None)
    
    str_result = '?'

    if 'trial' not in post_data:
        str_result += 'outdir=' + sdir + '&'
        return str_result
    #
    # read parameters of the design & function spec.
    #
    _trial = safe_retrieve_one(post_data, 'trial', str(long(time.time())))
    _designobj = json.loads(post_data['forte'][0])
    _resolution = safe_retrieve_all(_designobj, 'resolution', None)
    _design = safe_retrieve_all(_designobj, 'design', None)
    _loadpoints = safe_retrieve_all(_designobj, 'loadpoints', None)
    _loadvalues = safe_retrieve_all(_designobj, 'loadvalues', None)
    _emptiness = safe_retrieve_all(_designobj, 'emptiness', None)
    _boundaries = safe_retrieve_all(_designobj, 'boundaries', None)
    _material = float(safe_retrieve_one(post_data, 'material', amnt))

    #
    #   convert to matlab input
    #
    dof = 2
    nnodes = pow(2, dof)

    # resolution, material & trial
    nelx = _resolution[0]
    nely = _resolution[1]
    material = _material * 1.0 * len(_design) / (nelx * nely)
    print nelx, nely, material

    matinput = {'TRIAL':_trial, 'NELX':nelx, 'NELY':nely, 'VOLFRAC':material,\
     'FIXEDDOFS':[], 'LOADNODES':[], 'LOADVALUES':[]}
    
    # boundary
    boundary_nodes = [node_nums_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _boundaries]
    tb_boundary = empty(dof*(nelx+1)*(nely+1)).tolist()
    for node in boundary_nodes:
        list_nodes = node.tolist()
        for idx in list_nodes:
            tb_boundary[dof*(idx-1)+1] = 1
            tb_boundary[dof*(idx-1)+2] = 1
    for idx in xrange(0, len(tb_boundary)):
        if tb_boundary[idx] == 1:
            matinput['FIXEDDOFS'].append(idx)
    # print matinput['FIXEDDOFS']

    # load
    tb_loadnodes = []
    for x in _loadpoints:
        node = node_nums_2d(nelx, nely, x[0] + 1, x[1] + 1)
        list_nodes = node.tolist()
        for idx in list_nodes:
            tb_loadnodes.append(dof*(idx-1)+1)
            tb_loadnodes.append(dof*(idx-1)+2)

    tb_loadvalues = []
    for v in _loadvalues:
        vsum = sqrt(v[0]**2+v[1]**2)
        for i in xrange(0, nnodes):
            tb_loadvalues.append(v[0]/vsum)
            tb_loadvalues.append(v[1]/vsum)
    
    matinput['LOADNODES'] = tb_loadnodes
    # print len(matinput['LOADNODES'])
    matinput['LOADVALUES'] = tb_loadvalues
    # print len(matinput['LOADVALUES'])

    # active/passive/favored elements
    matinput['ACTVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _design]
    matinput['PASVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _emptiness]
    # print matinput['PASVELMS']
    matinput['FAVELMS'] = matinput['ACTVELMS']

    matargs = [sdir + '//' + matinput['TRIAL'], matinput['NELX'], matinput['NELY'],\
        matinput['VOLFRAC'], 3, 1.5, 1, 50, matinput['FIXEDDOFS'], matinput['LOADNODES'],\
        matinput['LOADVALUES'], matinput['ACTVELMS'], matinput['FAVELMS'], matinput['PASVELMS']]

    input_file = open(INPUTFILE, 'w')
    input_file.write(';'.join([str(x) for x in matargs]))
    input_file.close()
    # [debug] copy it to matlab dir to debug in matlab
    subprocess.call('cp ' + INPUTFILE + ' /Users/hotnAny/Documents/MATLAB', shell=True)

    _log('prepared matlab input')

    return str_result

#
#   handling requests
#
class S(BaseHTTPRequestHandler):
    def __init__(self, request, client_address, server):
        BaseHTTPRequestHandler.__init__(self, request, client_address, server)

    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        self._set_headers()
        # do something

    def do_HEAD(self):
        self._set_headers()
        # do something

    def do_POST(self):
    	# prepare for response
        self._set_headers()

        content_length = int(self.headers['Content-Length'])
        post_str = self.rfile.read(content_length)
        post_data = parse_qs(urlparse(self.path + post_str).query)

        global session_dir
        result_msg = proc_post_data(post_data, sdir=session_dir)

        print result_msg
        self.wfile.write(result_msg)

#
#   running the server
#
def run(server_class=HTTPServer, handler_class=S, port=80):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print 'topopt input server up...'
    httpd.serve_forever()

#
#   main function entry point
#
if __name__ == "__main__":

    if len(argv) != 3:
        print 'usage: ./topy_server.py <port_num> <input_file_path>'
        quit()

    INPUTFILE = argv[2]
    subprocess.call('rm -rf server_session*', shell=True)
    global session_dir
    session_dir = 'server_session_' + str(long(time.time()))
    subprocess.call('mkdir ' + session_dir, shell=True)

    run(port=int(argv[1]))
    
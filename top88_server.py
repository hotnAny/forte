#!/usr/bin/env python

##########################################################################
#
#   server for running top88
#
#   by xiangchen@acm.org
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

MCRPATH = '/Applications/MATLAB/MATLAB_Runtime/v91'
LIBPATH = '.:' + MCRPATH + '/runtime/maci64'
LIBPATH = LIBPATH + ':' + MCRPATH + '/bin/maci64'
LIBPATH = LIBPATH + ':' + MCRPATH + '/sys/os/maci64'
TOP88PATH = './top88/for_testing/top88.app/Contents/MacOS/top88'

T = int(round(time.time() * 1000))
def _log(msg):
    global T
    t = int(round(time.time() * 1000))
    if msg != None:
        print msg + ': ' + str(t - T) + 'ms'
    T = t
    return t

#
#   xac: get element number
#
def elm_num_2d(nelx, nely, mpx, mpy):
    return nely * (mpx - 1) + mpy

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
    # if sdir != None:
    #     subprocess.call('rm ' + sdir + '/forte_*', shell=True)

    if 'forte' not in post_data:
        return 'no design information'
    #
    # read parameters of the design & function spec.
    #
    _designobj = json.loads(post_data['forte'][0])
    _resolution = safe_retrieve_all(_designobj, 'resolution', None)
    _design = safe_retrieve_all(_designobj, 'design', None)
    _loadpoints_set = safe_retrieve_all(_designobj, 'loadpoints', None)
    _loadvalues_set = safe_retrieve_all(_designobj, 'loadvalues', None)
    _emptiness = safe_retrieve_all(_designobj, 'emptiness', None)
    _boundaries = safe_retrieve_all(_designobj, 'boundaries', None)
    _material = float(safe_retrieve_one(post_data, 'material', amnt))

    # print loadvalues, emptiness, boundaries, material

    #
    #   convert to matlab input
    #
    dof = 2
    nnodes = pow(2, dof)
    # resolution, material & trial
    nelx = _resolution[0]
    nely = _resolution[1]
    # material = _material * 1.0 * len(_design) / (nelx * nely)
    material = 0.3
    print material
    trial = 'forte_' + str(long(time.time()))
    matinput = {'TRIAL':trial, 'NELX':nelx, 'NELY':nely, 'VOLFRAC':material,\
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
    for loadpoints in _loadpoints_set:
        for x in loadpoints:
            nodes = node_nums_2d(nelx, nely, x[0] + 1, x[1] + 1)
            for idx in list_nodes:
                tb_loadnodes.append(dof*(idx-1)+1)
                tb_loadnodes.append(dof*(idx-1)+2)

    tb_loadvalues = []
    for loadvalues in _loadvalues_set:
        for v in loadvalues:
            for i in xrange(0, nnodes):
                tb_loadvalues.append(v[0])
                tb_loadvalues.append(v[1])
    
    matinput['LOADNODES'] = tb_loadnodes
    # print len(matinput['LOADNODES'])
    matinput['LOADVALUES'] = tb_loadvalues
    # print len(matinput['LOADVALUES'])

    # active/passive/favored elements
    matinput['ACTVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _design]
    matinput['PASVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _emptiness]
    matinput['FAVELMS'] = matinput['PASVELMS']
    # print matinput['ACTVELMS']
    # print matinput['PASVELMS']

    # tpd, debug_voxelgrid = gen_tpd(designObj, resolution, material)
    # print ''.join(debug_voxelgrid)[::-1]
    # probname = optimize(tpd, gradient)

    # # marching_cube(sdir + '/' + probname + '_optimized.vxg')
    # subprocess.call(postproc_dir + '/' + 'marching_cube.py ' + probname + '_optimized.vxg', shell=True)

    # if sdir != None:
    #     subprocess.call('mv ' + probname + '* ' + sdir, shell=True)

    matargs = [sdir + '//' + matinput['TRIAL'], matinput['NELX'], matinput['NELY'],\
        matinput['VOLFRAC'], 3, 1.5, 1, 50, matinput['FIXEDDOFS'], matinput['LOADNODES'],\
        matinput['LOADVALUES'], matinput['ACTVELMS'], matinput['FAVELMS'], matinput['PASVELMS']]

    INPUTFILE = '~matinput'
    input_file = open(INPUTFILE, 'w')
    input_file.write(';'.join([str(x) for x in matargs]))
    input_file.close()
    # [debug] copy it to matlab dir to debug in matlab
    subprocess.call('cp ' + INPUTFILE + ' /Users/hotnAny/Documents/MATLAB', shell=True)

    # test run
    _log(None)
    subprocess.check_call([TOP88PATH, os.getcwd() + '/' + INPUTFILE],\
        env=dict(os.environ, SQSUB_VAR="visible in this subprocess"))
    _log('top88')

    str_result = '?'
    # str_result += 'name=' + tpd['PROB_NAME'] + '&'
    # str_result += 'outpath=vxg.dae'

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
        try:
            result_msg = proc_post_data(post_data, sdir=session_dir)
        except:
            traceback.print_exc()
            result_msg = 'error'

        print result_msg
        self.wfile.write(result_msg)

#
#   running the server
#
def run(server_class=HTTPServer, handler_class=S, port=80):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print 'top88 server up...'
    httpd.serve_forever()

#
#   main function entry point
#
if __name__ == "__main__":

    if len(argv) != 2:
    	print 'usage: ./topy_server.py <port_num>'
    	quit()

    subprocess.call('rm -rf server_session*', shell=True)
    global session_dir
    session_dir = 'server_session_' + str(long(time.time()))
    subprocess.call('mkdir ' + session_dir, shell=True)
    
    # print LIBPATH
    os.environ['DYLD_LIBRARY_PATH'] = LIBPATH

    run(port=int(argv[1]))
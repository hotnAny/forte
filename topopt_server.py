#!/usr/bin/env python

##########################################################################
#
#   server for writting input to top88, v0.2
#
#   by xiangchen@acm.org, 08/2017
#
##########################################################################

from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from urlparse import urlparse, parse_qs
from sys import argv
import time
import subprocess
import json
from math import sqrt, floor, cos, pi, exp
from numpy import array, empty

# default input file path/name
INPUTFILE = '~optinput'
MAXSIMILARITY = 10
DEFAULTLAMBDA = 0.1
MINLAMBDAOPTIN = 0.001
MAXLAMBDAOPTIN = 0.199
MINLAMBDAVARIATION = 0.01
MAXLAMBDAVARIATION = 0.79
DEFAULTTYPE = 0

# types of optimization
ADDSTRUCTS = 0
GETVARIATION = 1
OPTIMIZEWITHIN = 2

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
#   compute distance field
#
def get_distance_field(elms, nelx, nely, m, alpha):
    infinity = 1e6
    df = []
    inc = []

    # initialize distance field
    for j in xrange(0, nely):
        row = []
        for i in xrange(0, nelx):
            row.append(infinity)
        df.append(row)

    # initialize distance field incrementals
    for j in xrange(0, nely):
        row = []
        for i in xrange(0, nelx):
            row.append(1)
        inc.append(row)

    buf_prev = []
    num = nelx * nely
    max_val = 0
    neighbors = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]

    buf_all = []

    idx = 0
    for elm_num in elms:
        mpz = int(floor(elm_num / (nelx * nely)))
        mpx = int(floor((elm_num - mpz * (nelx * nely)) / nely))
        mpy = int(floor(elm_num - mpz * (nelx * nely) - mpx * nely))
        df[mpy][mpx] = 0
        # inc[mpx][mpy] = min_inc + elm_vals[idx] * (1 - min_inc)
        buf_prev.append([mpx, mpy])
        buf_all.append([mpx, mpy])
        idx += 1

    cnt = 0
    for j in xrange(0, nely):
        for i in xrange(0, nelx):
            cnt += 1 if df[j][i] != infinity else 0

    while cnt < num:
        buf = []
        for idx in buf_prev:
            val_df = df[idx[1]][idx[0]]
            # val_inc = inc[idx[0]][idx[1]]
            val_inc = 1
            for didx in neighbors:
                ii = idx[0] + didx[0]
                jj = idx[1] + didx[1]
                if 0 <= ii and ii < nelx and 0 <= jj and jj < nely:
                    if df[jj][ii] == infinity:
                        df[jj][ii] = val_df + val_inc
                        # inc[ii][jj] = min(1, val_inc * 1.1)
                        max_val = max(df[jj][ii], max_val)
                        buf.append([ii, jj])
                        cnt += 1

        buf_prev = list(buf)

    if m >= 1:
        max_val *= 1.0
        for i in xrange(0, nelx):
            for j in xrange(0, nely):
                df[j][i] /= max_val
                df[j][i] = min(df[j][i], 1)
                df[j][i] = max(0, df[j][i])

                df[j][i] = alpha * (cos(df[j][i] * pi / 2))**m

    # debug, print normalized distance field
    # for i in xrange(0, nelx):
    #     print ' '.join([(format(x, '1.1f') if x > 0.9 else '   ') for x in df[i]])
    # return [float(format(j, '1.2f')) for i in df for j in i]

    return df

#
#   processing incoming data
#
def proc_post_data(post_data, res=48, amnt=1.0, sdir=None):
    _log(None)
    
    str_result = '?'

    if 'stop' in post_data:
        subprocess.call('chmod 444 ' + session_dir, shell=True)
        return str_result

    subprocess.call('chmod 777 ' + session_dir, shell=True)
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
    _similarity = float(safe_retrieve_one(post_data, 'similarity', 1))
    _type = float(safe_retrieve_one(post_data, 'type', DEFAULTTYPE))
    _favpoints = safe_retrieve_all(_designobj, 'favpoints', None)
    _slimpoints = safe_retrieve_all(_designobj, 'slimpoints', None)
    _lastoutput = str(safe_retrieve_all(_designobj, 'lastoutput', None))
    _editweight = float(safe_retrieve_one(post_data, 'editweight', 1))

    #
    #   convert to matlab input
    #
    dof = 2
    nnodes = pow(2, dof)

    # resolution, material & trial
    nelx = _resolution[0]
    nely = _resolution[1]
    material = _material
    print nelx, nely, material

    optinput = {'TRIAL':_trial, 'NELX':nelx, 'NELY':nely, 'VOLFRAC':material,\
     'FIXEDDOFS':[], 'LOADNODES':[], 'LOADVALUES':[]}
    
    # boundary
    boundary_nodes = [node_nums_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _boundaries]
    tb_boundary = empty(dof*(nelx+1)*(nely+1)).tolist()
    for node in boundary_nodes:
        list_nodes = node.tolist()
        for idx in list_nodes:
            tb_boundary[dof*(idx-1)+0] = 1
            tb_boundary[dof*(idx-1)+1] = 1
    for idx in xrange(0, len(tb_boundary)):
        if tb_boundary[idx] == 1:
            optinput['FIXEDDOFS'].append(idx+1)

    # load
    tb_loadnodes = []
    for x in _loadpoints:
        node = node_nums_2d(nelx, nely, x[0] + 1, x[1] + 1)
        list_nodes = node.tolist()
        for idx in list_nodes:
            tb_loadnodes.append(dof*(idx)-1)
            tb_loadnodes.append(dof*(idx))

    tb_loadvalues = []
    for v in _loadvalues:
        vsum = sqrt(v[0]**2+v[1]**2)
        for i in xrange(0, nnodes):
            tb_loadvalues.append(v[0]/vsum)
            tb_loadvalues.append(v[1]/vsum)
    
    optinput['LOADNODES'] = tb_loadnodes
    optinput['LOADVALUES'] = tb_loadvalues

    # active/passive/favored(obselete)/less-material elements
    optinput['ACTVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _design]
    optinput['PASVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _emptiness]
    optinput['FAVELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _favpoints]

    optinput['SLIMELMS'] = [elm_num_2d(nelx, nely, x[0] + 1, x[1] + 1) for x in _slimpoints]

    optinput['LASTOUTPUT'] = _lastoutput

    # [debug] do NOT remove
    # vis_str = ''
    # for j in xrange(0, nely+1):
    #     for i in xrange(0, nelx+1):
    #         idx = i * (nely+1) + j
    #         if tb_boundary[dof*idx]== 1 and tb_boundary[dof*idx+1]==1:
    #             vis_str += ' x '
    #         elif dof*idx in tb_loadnodes and dof*idx+1 in tb_loadnodes:
    #             vis_str += ' O '
    #         elif elm_num_2d(nelx, nely, i + 1, j + 1) in optinput['LESSELMS']:
    #             vis_str += ' # '
    #         else:
    #             vis_str += ' . '
    #     vis_str += '\n'
    # print vis_str

    # type of optimization
    optinput['TYPE'] = _type
    
    if _type == ADDSTRUCTS:
        # use similarity to set lambda for mass transport
        optinput['LAMBDA'] = MINLAMBDAVARIATION + (MAXLAMBDAVARIATION-MINLAMBDAVARIATION) * _similarity / MAXSIMILARITY
        # then set it to max so to use a constant max distance field
        _similarity = MAXSIMILARITY
    elif _type == GETVARIATION:
        optinput['LAMBDA'] = 0
        _similarity = _similarity
    elif _type == OPTIMIZEWITHIN:
        optinput['LAMBDA'] = MINLAMBDAOPTIN + (MAXLAMBDAOPTIN-MINLAMBDAOPTIN) * (1-_similarity / MAXSIMILARITY)
        _similarity = -1

    optinput['EDITWEIGHT'] = 2**_editweight

    df = get_distance_field(optinput['ACTVELMS'], nelx, nely, 2**_similarity, 1)
    s = material * nelx * nely / sum([sum(x) for x in df])    
    optinput['DISTFIELD'] = ';'.join([','.join([format(y*s, '1.2f') for y in x]) for x in df])

    optargs = [sdir + '//' + optinput['TRIAL'], optinput['NELX'], optinput['NELY'],\
        optinput['VOLFRAC'], 3, 1.5, 1, 40, optinput['FIXEDDOFS'], optinput['LOADNODES'],\
        optinput['LOADVALUES'], optinput['ACTVELMS'], optinput['FAVELMS'], optinput['PASVELMS'],\
        optinput['DISTFIELD'], optinput['LAMBDA'], optinput['SLIMELMS'], optinput['LASTOUTPUT'],\
        optinput['TYPE'], optinput['EDITWEIGHT']]

    input_file = open(INPUTFILE, 'w')
    input_file.write('&'.join([str(x) for x in optargs]))
    input_file.close()

    # [debug] copy it to matlab dir to debug in matlab
    subprocess.call('cp ' + INPUTFILE + ' matlab/', shell=True)

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

    def do_HEAD(self):
        self._set_headers()

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
    subprocess.call('chmod 777 ' + session_dir, shell=True)

    run(port=int(argv[1]))
    
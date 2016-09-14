#!/usr/bin/env python

##########################################################################
#
#   topy server for project forte
#
#   by xiangchen@acm.org
#
##########################################################################

from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from urlparse import urlparse, parse_qs
import sys
import time
import subprocess
import json
import math
import traceback

from topy_api import gen_tpd, optimize

session_dir = ''

postproc_dir = 'post_processing'
# sys.path.append(postproc_dir)
# from marching_cube import marching_cube

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
    if sdir != None:
        subprocess.call('rm ' + sdir + '/forte_*', shell=True)

    if 'forte' not in post_data:
        return 'no design information'
    #
    # read parameters of the design & function spec.
    #
    designObj = json.loads(post_data['forte'][0])
    dimension = int(safe_retrieve_one(post_data, 'dimension', 2))
    design = safe_retrieve_all(designObj, 'design', None)
    loads = safe_retrieve_all(designObj, 'loads', None)
    clearances = safe_retrieve_all(designObj, 'clearances', None)
    boundaries = safe_retrieve_all(designObj, 'boundaries', None)
    resolution = int(safe_retrieve_one(post_data, 'resolution', res))
    material = float(safe_retrieve_one(post_data, 'material', amnt))
    gradient = float(safe_retrieve_one(post_data, 'gradient', 0.1))

    tpd, debug_voxelgrid = gen_tpd(designObj, resolution, material)
    print ''.join(debug_voxelgrid)[::-1]
    probname = optimize(tpd, gradient)

    # marching_cube(sdir + '/' + probname + '_optimized.vxg')
    subprocess.call(postproc_dir + '/' + 'marching_cube.py ' + probname + '_optimized.vxg', shell=True)

    if sdir != None:
        subprocess.call('mv ' + probname + '* ' + sdir, shell=True)

    str_result = '?'
    str_result += 'name=' + tpd['PROB_NAME'] + '&'
    str_result += 'outpath=vxg.dae'

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
    print 'topy server up...'
    httpd.serve_forever()

#
#   main function entry point
#
if __name__ == "__main__":
    from sys import argv

    if len(argv) != 2:
    	print 'usage: ./topy_server.py <port_num>'
    	quit()

    subprocess.call('rm -rf server_session*', shell=True)
    session_dir = 'server_session_' + str(long(time.time()))
    subprocess.call('mkdir ' + session_dir, shell=True)
    offline = False
    run(port=int(argv[1]))

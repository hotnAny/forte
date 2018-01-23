#!/usr/bin/env python

from sys import argv
import subprocess

if __name__ == "__main__":
	if len(argv) < 2:
		print 'usage: ./serverup.py <port_number>'
		quit()

	subprocess.call('nohup python -mSimpleHTTPServer ' + argv[1] + ' > /dev/null 2>&1 &', shell=True)
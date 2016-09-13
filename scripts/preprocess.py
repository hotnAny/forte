"""
# =============================================================================
# some preprocessing steps to use topy
#
# by xiang 'anthony' chen
# =============================================================================
"""

# test case 1
# 10 10 1 1 1 1 10 10 1

import nodenums
import sys
import math

#
# in R^3, distance from a point (x, y, z) to a line defined by (x1, y1, z1) and (x2, y2, z2)
#
# ref: http://mathworld.wolfram.com/Point-LineDistance3-Dimensional.html
#
def p2l(x, y, z, x1, y1, z1, x2, y2, z2):
	dx1 = x1-x
	dy1 = y1-y
	dz1 = z1-z
	dx2 = x2-x
	dy2 = y2-y
	dz2 = z2-z
	tu = (dx2-dx1)*dx1 + (dy2-dy1)*dy1 + (dz2-dz1)*dz1
	tb = (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1) + (z2-z1)*(z2-z1)
	t = -tu/tb

	return math.sqrt(dx1*dx1+dy1*dy1+dz1*dz1 - tu*tu/tb)

if __name__ == "__main__":
	# print 'Number of arguments:', len(sys.argv), 'arguments.'
	# print 'Argument List:', str(sys.argv)

	if len(sys.argv) >= 7:
		
		nelx = int(sys.argv[1])
		nely = int(sys.argv[2])
		nelz = int(sys.argv[3])
		mpx = int(sys.argv[4])
		mpy = int(sys.argv[5])
		mpz = int(sys.argv[6])

		if len(sys.argv) == 7:	# output
			nodenums.node_nums_3d(nelx, nely, nelz, mpx, mpy, mpz)
		elif len(sys.argv) == 10: # output elements along a line
			mpx2 = int(sys.argv[7])
			mpy2 = int(sys.argv[8])
			mpz2 = int(sys.argv[9])

			elms = []
			
			str_elms = ''
			for x in range(1, nelx+1):
				for y in range(1, nely+1):
					for z in range(1, nelz+1):
						if p2l(x, y, z, mpx, mpy, mpz, mpx2, mpy2, mpz2) <= 2:
							elm = y + nely * (x - 1) + nelx * nely * (z - 1)
							str_elms += (str(elm) + ';')
			print str_elms
	else: # unit test
		print p2l(1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0)
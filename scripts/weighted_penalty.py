"""
#
#	testing the computing of weighted penalty based on active elements
#	compute a 3d lookup table showing the weighted penalty for each element
#
"""
import math
from numpy import array

# output
pw = []

p0 = 3
nelx = 4 #25
nely = 1
nelz = 4 #25
r = math.sqrt(nelx**2 + nely**2 + nelz**2) / 2;
# actv_elms = [161, 136, 135, 110, 109, 84, 83, 82, 81, 56, 55, 54, 53, 52, 51, 50, 210, 185, 186, 187, 162, 163, 164, 139, 140, 141, 116, 117, 118, 93, 94, 95, 96, 97, 98, 99, 338, 313, 287, 261, 235, 234, 209, 208, 207, 206, 205, 180, 179, 178, 202, 201, 200, 460, 435, 436, 411, 412, 387, 388, 363, 364, 365, 366, 367, 368, 343, 344, 345, 346, 347, 348, 349, 586, 561, 536, 510, 485, 484, 459, 434, 433, 407, 406, 380, 379, 378, 377, 352, 351, 350]

actv_elms = [4, 6, 7, 10, 15]

#
#	convert elm num to coord/index
#
actv_elms_coord = []
for elm_num in actv_elms:
	elm_num -= 1	# original number starts from 1
	mpz = math.floor(elm_num / (nelx * nely))
	mpx = math.floor((elm_num - mpz * (nelx * nely)) / nely)
	mpy = math.floor(elm_num - mpz * (nelx * nely) - mpx * nely)
	elm_num += 1

	# ---------------------------------------------------
	# TESTING
	# enback = nely * mpx + mpy + 1
	# elm_num2 = enback + nelx * nely * mpz

	# if elm_num != elm_num2:
	# 	print ['wrong! ', elm_num, ' <> ', elm_num2]
	# ---------------------------------------------------
	actv_elms_coord.append([mpx, mpy, mpz]);

for i in xrange(nelx):
	slashes = []
	for j in xrange(nely):
		dices = []
		for k in xrange(nelz):
			# print [i, j, k]
			dmin = r
			for elm in actv_elms_coord:
				d = math.sqrt((i-elm[0])**2 + (j-elm[1])**2 + (k-elm[2])**2)
				dmin = min(dmin, d)
			# dices.append(round(dmin, 2))
			dices.append(p0 * (1 - dmin/r))
		slashes.append(dices)
		print(dices)
	pw.append(slashes)

print pw[2][0][3]
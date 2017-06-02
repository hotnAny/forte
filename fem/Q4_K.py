"""
# =============================================================================
# Write the stiffness matrix of finite element to file. The created file name
# is equal to the string between the underscores of *this* file's name, plus a
# 'K' extension, e.g.,
#
#     python ELEM_K.py
#
# gives a file named ELEM.K in the same directory.
#
# Author: William Hunter
# Copyright (C) 2008, 2015, William Hunter.
# =============================================================================
"""

from __future__ import division

from sympy import symbols, Matrix, diff, integrate, zeros

from numpy import abs, array

from matlcons import *

# Get file name:
ke_fname = __file__.split('_')[0] + '.K'
c_fname = __file__.split('_')[0] + '.C'
b_fname = __file__.split('_')[0] + '.B'

try:
    f = open(ke_fname)
    print ke_fname ,'(stiffness matrix) exists!'
    f.close()
except IOError:
    # SymPy symbols:
    a, b, x, y = symbols('a b x y')
    E, nu = symbols('E nu')
    N1, N2, N3, N4 = symbols('N1 N2 N3 N4')
    xlist = [x, x, x, x, x, x, x, x]
    ylist = [y, y, y, y, y, y, y, y]
    yxlist = [y, x, y, x, y, x, y, x]

    # Shape functions:
    N1 = (a - x) * (b - y) / (4 * a * b)
    N2 = (a + x) * (b - y) / (4 * a * b)
    N3 = (a + x) * (b + y) / (4 * a * b)
    N4 = (a - x) * (b + y) / (4 * a * b)

    # Create strain-displacement matrix B:
    B0 = map(diff, [N1, 0, N2, 0, N3, 0, N4, 0], xlist)
    B1 = map(diff, [0, N1, 0, N2, 0, N3, 0, N4], ylist)
    B2 = map(diff, [N1, N1, N2, N2, N3, N3, N4, N4], yxlist)
    B = Matrix([B0, B1, B2])

    # Create constitutive (material property) matrix for plane stress:
    C = (E / (1 - nu**2)) * Matrix([[1, nu, 0],
                                    [nu, 1, 0],
                                    [0,  0, (1 - nu) / 2]])

    print C.subs({nu:_nu})
    print B.subs({a:_a, b:_b, x:0, y:0})

    dK = B.T * C * B

    # Barr = array(B.subs({a:_a, b:_b, x:0, y:0})).astype('double')
    # Barr.dump(b_fname)
    # Carr = array(C.subs({nu:_nu})).astype('double')
    # Carr.dump(c_fname)

    # Integration:
    print 'SymPy is integrating: K for Q4...'
    K = dK.integrate((x, -a, a),(y, -b, b))

    # Convert SymPy Matrix to NumPy array:
    K = array(K.subs({a:_a, b:_b, E:_E, nu:_nu})).astype('double')

    # Set small (<< 0) values equal to zero:
    K[abs(K) < 1e-6] = 0

    # Create file:
    K.dump(ke_fname)
    print 'Created', ke_fname, '(stiffness matrix).'

def getB(_x, _y, _z):
    global B
    return B.subs({a:_a, b:_b, x:_x, y:_y})

def getC():
    global C
    return C.subs({nu:_nu})

# EOF Q4_K.py

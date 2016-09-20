"""
# =============================================================================
# A class to optimise the topology of a design domain for defined boundary
# conditions. Data is read from an input file, see 'examples' directory.
#
# Author: William Hunter
# Copyright (C) 2008, 2015, William Hunter.
# =============================================================================
"""

from __future__ import division

from string import lower

from numpy import arange, array, dot, floor, indices, maximum, minimum, ones,\
put, setdiff1d, in1d, sqrt, where, zeros, zeros_like, append, empty,\
abs, take, log, allclose, clip, log2, equal, subtract

from pysparse import superlu, itsolvers, precon

from parser import tpd_file2dict

import math

__all__ = ['Topology']

MAX_ITERS = 250

SOLID, VOID = 1.000, 0.001 #  Upper and lower bound value for design variables
KDATUM = 0.1 #  Reference stiffness value of springs for mechanism synthesis

# Constants for exponential approximation:
A_LOW = -3 #  Lower restriction on 'a' for exponential approximation
A_UPP = -1e-5 #  Upper restriction on 'a' for exponential approximation



# ========================
# === ToPy error class ===
# ========================
class ToPyError(Exception):
    """
    Base class for exceptions in this module.

    """
    pass #  Use default __init__ of Exception

# =======================
# === ToPy base class ===
# =======================
class Topology:
    """
    A class to optimise the topology of a design domain for defined boundary
    values. Data is read from an input file (see 'examples' folder).

    """
    def __init__(self):
        self.topydict = {} #  Store tpd file data in dictionary
        self.pcount = 0 #  Counter for continuation of p
        self.qcount = 0 #  Counter for continuation of q for GSF
        self.itercount = 0 #  Internal counter
        self.change = 1
        self.svtfrac = None

    # ======================
    # === Public methods ===
    # ======================
    def load_tpd_file(self, fname):
        """
        Load a ToPy problem definition (TPD) file, return a dictionary:

        INPUTS:
            fname -- file name of tpd file.

        EXAMPLES:
            >>> import topy
            >>> t = topy.Topology()
            >>> # load a ToPy problem definition file:
            >>> t.load_tpd_file('filename.tpd')

        """
        self.tpdfname = fname
        self.topydict = tpd_file2dict(fname)

    def set_top_params(self):
        """
        Set topology optimisation problem parameters (you must already have
        instantiated a Topology object).

        EXAMPLES:
            >>> import topy
            >>> t = topy.Topology()
            >>> # load a ToPy problem definition file:
            >>> t.load_tpd_file('filename.tpd')
            >>> # now set the problem parameters:
            >>> t.set_top_params()

        You can now access all the class methods or instance variables. To see
        the dictionary of parameters, just type

            >>> t.topydict

        You can also reset some parameters without reloading the file, but use
        with caution. For example, you can change the filer radius (FILT_RAD)
        as follows:

            >>> t.topydict['FILT_RAD'] = 1.5

        Remember to reset the problem parameters again, whereafter you can
        solve the problem.

            >>> t.set_top_params()

        See also: load_tpd_file

        """
        print '-' * 79
        # Set all the mandatory minimum amount of parameters that constitutes
        # a completely defined topology optimisation problem:
        if not self.topydict:
            raise ToPyError('You must first load a TPD file!')
        self.probtype = self.topydict['PROB_TYPE'] #  Problem type
        self.probname = self.topydict['PROB_NAME'] #  Problem name
        self.volfrac = self.topydict['VOL_FRAC'] #  Volume fraction
        self.filtrad = self.topydict['FILT_RAD'] #  Filter radius
        self.p = self.topydict['P_FAC'] #  'Standard' penalisation factor
        self.dofpn = self.topydict['DOF_PN'] #  DOF per node
        self.e2sdofmapi = self.topydict['E2SDOFMAPI'] #  Elem to structdof map
        self.nelx = self.topydict['NUM_ELEM_X'] #  Number of elements in X
        self.nely = self.topydict['NUM_ELEM_Y'] #  Number of elements in Y
        self.nelz = self.topydict['NUM_ELEM_Z'] #  Number of elements in Z
        self.fixdof = self.topydict['FIX_DOF'] #  Fixed dof vector
        self.loaddof = self.topydict['LOAD_DOF'] #  Loaded dof vector
        self.loadval = self.topydict['LOAD_VAL'] #  Loaded dof values
        self.Ke = self.topydict['ELEM_K'] #  Element stiffness matrix
        self.K = self.topydict['K'] #  Global stiffness matrix
        if self.nelz:
            print 'Domain discretisation (NUM_ELEM_X x NUM_ELEM_Y x \
NUM_ELEM_Z) = %d x %d x %d' % (self.nelx, self.nely, self.nelz)
        else:
            print 'Domain discretisation (NUM_ELEM_X x NUM_ELEM_Y) = %d x %d'\
            % (self.nelx, self.nely)

        print 'Element type (ELEM_K) =', self.topydict['ELEM_TYPE']
        print 'Filter radius (FILT_RAD) =', self.filtrad

        # Check for either one of the following two, will take NUM_ITER if both
        # are specified.
        try:
            self.numiter = self.topydict['NUM_ITER'] #  Number of iterations
            print 'Number of iterations (NUM_ITER) = %d' % (self.numiter)
        except KeyError:
            self.chgstop = self.topydict['CHG_STOP'] #  Change stop criteria
            print 'Change stop value (CHG_STOP) = %.3e (%.2f%%)' \
            % (self.chgstop, self.chgstop * 100)
            self.numiter = MAX_ITERS

        # All DOF vector and design variables arrays:
        # This needs to be recoded at some point, perhaps. I originally
        # (incorrectly) thought I could do everything just by looking at DOF
        # per node, not so, Cartesian dimension also plays a role.
        # Thus, the 'if'* below is a hack for this to work, and it does...
        if self.dofpn == 1:
            if self.nelz == 0: #  *had to this
                self.e2sdofmapi = self.e2sdofmapi[0:4]
                self.alldof = arange(self.dofpn * (self.nelx + 1) * \
                (self.nely + 1))
                self.desvars = zeros((self.nely, self.nelx)) + self.volfrac
            else:
                self.alldof = arange(self.dofpn * (self.nelx + 1) * \
                (self.nely + 1) * (self.nelz + 1))
                self.desvars = zeros((self.nelz, self.nely, self.nelx)) + \
                self.volfrac
        elif self.dofpn == 2:
            self.alldof = arange(self.dofpn * (self.nelx + 1) * (self.nely +
            1))
            self.desvars = zeros((self.nely, self.nelx)) + self.volfrac
        else:
            self.alldof = arange(self.dofpn * (self.nelx + 1) *\
            (self.nely + 1) * (self.nelz + 1))
            self.desvars = zeros((self.nelz, self.nely, self.nelx)) + \
            self.volfrac
        self.df = zeros_like(self.desvars) #  Derivatives of obj. func. (array)
        self.freedof = setdiff1d(self.alldof, self.fixdof) #  Free DOF vector
        self.r = zeros_like(self.alldof).astype(float) #  Load vector
        self.r[self.loaddof] = self.loadval #  Assign load values at loaded dof
        self.rfree = self.r[self.freedof] #  Modified load vector (free dof)
        self.d = zeros_like(self.r) #  Displacement vector
        self.dfree = zeros_like(self.rfree) #  Modified load vector (free dof)
        # Determine which rows and columns must be deleted from global K:
        self._rcfixed = where(in1d(self.alldof, self.fixdof), 0, 1)

        # Print this to screen, just so that the user knows what type of
        # problem is being solved:
        print 'Problem type (PROB_TYPE) = ' + self.probtype
        print 'Problem name (PROB_NAME) = ' + self.probname

        # Set extra parameters if specified:
        # (1) Continuation parameters for 'p':
        try:
            self._pmax = self.topydict['P_MAX']
            self._phold = self.topydict['P_HOLD']
            self._pincr = self.topydict['P_INCR']
            self._pcon = self.topydict['P_CON']
        except KeyError: #  If they're None
            print 'Continuation of penalisation factor (P_FAC) not specified'
            self._pmax = 1
            self._pcon = self.numiter #  'p' stays constant for all iterations
            self._phold = self.numiter
        # (2) Extra penalisation factor (q) and continuation parameters:
        try:
            self.q = self.topydict['Q_FAC']
            print 'GSF active'
        except KeyError:
            print 'GSF not active'
            self.q = 1
        try:
            self._qmax = self.topydict['Q_MAX']
            self._qhold = self.topydict['Q_HOLD']
            self._qincr = self.topydict['Q_INCR']
            self._qcon = self.topydict['Q_CON']
        except KeyError:  #  If they're None
            self._qmax = self.q
            self._qcon = self.numiter #  'q' stays constant for all iterations
            self._qhold = self.numiter
        # (3) Exponential approximation of eta:
        try:
            self.eta = float(self.topydict['ETA']) * ones(self.desvars.shape)
            print 'Damping factor (ETA) = %3.2f' % (self.eta.mean())
        except ValueError:
            if self.topydict['ETA'] == 'exp':
                #  Initial value of exponent for comp and heat problems:
                self.a = - ones(self.desvars.shape)
                if self.probtype == 'mech':
                    #  Initial value of exponent for mech problems:
                    self.a = self.a * 7 / 3
                self.eta = 1 / (1 - self.a)
                print 'Damping factor (ETA) = exp'
        # (4) Diagonal quadratic approximation:
        try:
            self.approx = lower(self.topydict['APPROX'])
        except KeyError:
            self.approx = None
        if self.approx == 'dquad':
            print 'Using diagonal quadratic approximation (APPROX = dquad)'
        # (5) Set passive elements:
        self.pasv = self.topydict['PASV_ELEM']
        if self.pasv.any():
            print 'Passive elements (PASV_ELEM) specified'
        else:
            print 'No passive elements (PASV_ELEM) specified'
        # (6) Set active elements:
        self.WEIGHTEDPENALTY = False
        self.actv = self.topydict['ACTV_ELEM']
        if self.actv.any():
            print 'Active elements (ACTV_ELEM) specified'
            #
            #
            #################### CONSTRUCTION AREA BEGINS ####################
            #
            #
            if self.WEIGHTEDPENALTY:
                self.pw = []  # penalty weights
                r = math.sqrt(self.nelx**2 + self.nely**2 + self.nelz**2) / 2
                # p0 = self.p * 0.5
                #
                #   convert elm num to coord/index
                #
                self.actv_coords = []
                for elm_num in self.actv:
                    # elm_num -= 1    # original number starts from 1 <- yes, but it's corrected in parser.py
                    mpz = math.floor(elm_num / (self.nelx * self.nely))
                    mpx = math.floor((elm_num - mpz * (self.nelx * self.nely)) / self.nely)
                    mpy = math.floor(elm_num - mpz * (self.nelx * self.nely) - mpx * self.nely)
                    #elm_num += 1    # restore original value <- no need
                    self.actv_coords.append([mpx, mpy, mpz]);
                print '[xac] precomputed weighted penalties'

                #
                #   weigh penalty based on min dist to actv elms
                #
                for i in xrange(self.nelx):
                    slashes = []
                    for j in xrange(self.nely):
                        dices = []
                        for k in xrange(self.nelz):
                            # print [i, j, k]
                            dmin = r
                            for elm in self.actv_coords:
                                d = math.sqrt((i-elm[0])**2 + (j-elm[1])**2 + (k-elm[2])**2)
                                dmin = min(dmin, d)
                            # dices.append(round(dmin, 2)) # for testing
                            # dices.append(1 - dmin/r) # linear
                            dices.append(math.exp(1 - dmin/r)) # exp
                        slashes.append(dices)
                        # print(dices)
                    self.pw.append(slashes)
            #
            #
            #################### CONSTRUCTION AREA BEGINS ####################
            #
            #
        else:
            print 'No active elements (ACTV_ELEM) specified'

        #
        #
        #################### CONSTRUCTION AREA BEGINS ####################
        #
        #
        # (7) favored/disfavored elements
        self.favored = self.topydict['FAV_ELEM']
        self.fav_vals = self.topydict['FAV_VALU']
        self.df_favored = []
        if self.favored.any():
            print '[xac] favored elements (FAV_ELEM) specified'
            self.df_favored = self.get_distance_field(self.favored, self.fav_vals, self.nelx, self.nely)
        else:
            print '[xac] no favored elements (FAV_ELEM) specified'

        # self.disfavored = self.topydict['DISFAVORED']
        # self.df_disfavored = []
        # if self.disfavored.any():
        #     print '[xac] disfavored elements (DISFAVORED) specified'
        #     self.df_disfavored = self.get_distance_field(self.disfavored, self.nelx, self.nely)
        # else:
        #     print '[xac] no disfavored elements (DISFAVORED) specified'
        #
        #
        #################### CONSTRUCTION AREA BEGINS ####################
        #
        #

        # Set parameters for compliant mechanism synthesis, if they exist:
        if self.probtype == 'mech':
            if self.topydict['LOAD_DOF_OUT'].any() and \
            self.topydict['LOAD_VAL_OUT'].any():
                self.loaddofout = self.topydict['LOAD_DOF_OUT']
                self.loadvalout = self.topydict['LOAD_VAL_OUT']
            else:
                raise ToPyError('Not enough input data for mechanism \
synthesis!')

            self.rout = zeros_like(self.alldof).astype(float)
            self.rout[self.loaddofout] = self.loadvalout
            self.rfreeout = self.rout[self.freedof]
            self.dout = zeros_like(self.rout)
            self.dfreeout = zeros_like(self.rfreeout)
            ksin = ones(self.loaddof.shape, dtype='int') * KDATUM
            ksout = ones(self.loaddofout.shape, dtype='int') * KDATUM
            maskin = ones(self.loaddof.shape, dtype='int')
            maskout = ones(self.loaddofout.shape, dtype='int')
            if len(ksin) > 1:
                self.K.update_add_mask_sym([ksin, ksin], self.loaddof, maskin)
                self.K.update_add_mask_sym([ksout, ksout], self.loaddofout, \
                maskout)
            else:
                self.K.update_add_mask_sym([ksin], self.loaddof, maskin)
                self.K.update_add_mask_sym([ksout], self.loaddofout, maskout)
        print '=' * 79

    def fea(self):
        """
        Performs a Finite Element Analysis given the updated global stiffness
        matrix [K] and the load vector {r}, both of which must be in the
        modified state, i.e., [K] and {r} must represent the unconstrained
        system of equations. Return the global displacement vector {d} as a
        NumPy array.

        EXAMPLES:
            >>> t.fea()

        See also: set_top_params

        """
        if not self.topydict:
            raise ToPyError('You must first load a TPD file!')
        if self.itercount >= MAX_ITERS:
            raise ToPyError('Maximum internal number of iterations exceeded!')

        Kfree = self._updateK(self.K.copy())

        # if self.dofpn < 3 and self.nelz == 0: #  Direct solver
        thres_dim = 512
        if self.nelx <= thres_dim and self.nely <= thres_dim and self.nelz <= thres_dim:
            Kfree = Kfree.to_csr() #  Need CSR for SuperLU factorisation
            lu = superlu.factorize(Kfree)
            lu.solve(self.rfree, self.dfree)
            if self.probtype == 'mech':
                lu.solve(self.rfreeout, self.dfreeout)  # mechanism synthesis
                print 'debugging matrix solving'
                print subtract(self.rfreeout, dot(Kfree, self.dfreeout))
        else: #  Iterative solver for 3D problems
            Kfree = Kfree.to_sss()
            preK = precon.ssor(Kfree) #  Preconditioned Kfree
            (info, numitr, relerr) = \
            itsolvers.pcg(Kfree, self.rfree, self.dfree, 1e-8, 8000, preK)
            if info < 0:
                print 'PySparse error: Type:', info,', at', numitr, \
'iterations.'
                raise ToPyError('Solution for FEA did not converge.')
            else:
                print 'ToPy: Solution for FEA converged after', numitr, \
'iterations.'
            if self.probtype == 'mech':  # mechanism synthesis
                (info, numitr, relerr) = \
                itsolvers.pcg(Kfree, self.rfreeout, self.dfreeout, 1e-8, \
                8000, preK)
                if info < 0:
                    print 'PySparse error: Type:', info,', at', numitr, \
'iterations.'
                    raise ToPyError('Solution for FEA of adjoint load case \
                    did not converge.')

        # Update displacement vectors:
        self.d[self.freedof] = self.dfree
        # print self.d
        if self.probtype == 'mech':  # 'adjoint' vectors
            self.dout[self.freedof] = self.dfreeout
        # Increment internal iteration counter
        self.itercount += 1

    def sens_analysis(self):
        """
        Determine the objective function value and perform sensitivity analysis
        (find the derivatives of objective function). Return the design
        sensitivities as a NumPy array.

        EXAMPLES:
            >>> t.sens_analysis()

        See also: fea

        """
        if not self.topydict:
            raise ToPyError('You must first load a TPD file!')
        tmp = self.df.copy()
        self.objfval  = 0.0 #  Objective function value
        if self.nelz == 0: #  2D problem
            for ely in xrange(self.nely):
                for elx in xrange(self.nelx):
                    e2sdofmap = self.e2sdofmapi + self.dofpn *\
                                (ely + elx * (self.nely + 1))
                    qe = self.d[e2sdofmap]
                    qeTKeqe = dot(dot(qe, self.Ke), qe)
                    if self.probtype == 'comp':
                        self.objfval += (self.desvars[ely, elx] ** self.p) *\
                        qeTKeqe
                        tmp[ely, elx] = - self.p * self.desvars[ely, elx] **\
                        (self.p - 1) * qeTKeqe
                    elif self.probtype == 'heat':
                        self.objfval += (VOID + (1 - VOID) * \
                        self.desvars[ely, elx] ** self.p) * qeTKeqe
                        tmp[ely, elx] = - (1 - VOID) * self.p * \
                        self.desvars[ely, elx] ** (self.p - 1) * qeTKeqe
                    elif self.probtype == 'mech':
                        self.objfval = self.d[self.loaddofout]
                        qeout = self.dout[e2sdofmap]
                        tmp[ely, elx] = self.p * self.desvars[ely, elx]\
                        ** (self.p - 1) * dot(dot(qe, self.Ke), qeout)
        else: #  3D problem
            for elz in xrange(self.nelz):
                for ely in xrange(self.nely):
                    for elx in xrange(self.nelx):
                        e2sdofmap = self.e2sdofmapi + self.dofpn *\
                                    (ely + elx * (self.nely + 1) + elz *\
                                    (self.nelx + 1) * (self.nely + 1))
                        qe = self.d[e2sdofmap]
                        qeTKeqe = dot(dot(qe, self.Ke), qe)
                        #
                        #
                        #################### CONSTRUCTION AREA BEGINS ####################
                        #
                        #
                        p = self.p
                        if self.WEIGHTEDPENALTY == True:
                            p *= self.pw[elx][ely][elz]

                        if self.probtype == 'comp':
                            self.objfval += (self.desvars[elz, ely, elx] **\
                            p) * qeTKeqe
                            tmp[elz, ely, elx] = - p * self.desvars[elz, \
                            ely, elx] ** (p - 1) * qeTKeqe
                        #
                        #
                        ####################  CONSTRUCTION AREA ENDS  ####################
                        #
                        #
                        elif self.probtype == 'heat':
                            self.objfval += (VOID + (1 - VOID) * \
                            self.desvars[elz, ely, elx] ** self.p) * qeTKeqe
                            tmp[elz, ely, elx] = - (1 - VOID) *  self.p * \
                            self.desvars[elz, ely, elx] ** (self.p - 1) * \
                            qeTKeqe
                        elif self.probtype == 'mech':
                            self.objfval = self.d[self.loaddofout].sum()
                            qeout = self.dout[e2sdofmap]
                            tmp[elz, ely, elx] = self.p * \
                            self.desvars[elz, ely, elx] ** (self.p - 1) * \
                            dot(dot(qe, self.Ke), qeout)
        self.df = tmp

    def filter_sens_sigmund(self):
        """
        Filter the design sensitivities using Sigmund's heuristic approach.
        Return the filtered sensitivities.

        EXAMPLES:
            >>> t.filter_sens_sigmund()

        See also: sens_analysis

        """
        if not self.topydict:
            raise ToPyError('You must first load a TPD file!')
        tmp = zeros_like(self.df)
        rmin = int(floor(self.filtrad))
        if self.nelz == 0:
            U, V = indices((self.nelx, self.nely))
            for i in xrange(self.nelx):
                umin = maximum(i - rmin - 1, 0)
                umax = minimum(i + rmin + 2, self.nelx + 1)
                for j in xrange(self.nely):
                    vmin = maximum(j - rmin - 1, 0)
                    vmax = minimum(j + rmin + 2, self.nely + 1)
                    u = U[umin: umax, vmin: vmax]
                    v = V[umin: umax, vmin: vmax]
                    dist = self.filtrad - sqrt((i - u) ** 2 + (j - v) ** 2)
                    sumnumr = (maximum(0, dist) * self.desvars[v, u] *\
                               self.df[v, u]).sum()
                    sumconv = maximum(0, dist).sum()
                    tmp[j, i] = sumnumr / (sumconv * self.desvars[j, i])
        else:
            rmin3 = rmin
            U, V, W = indices((self.nelx, self.nely, self.nelz))
            for i in xrange(self.nelx):
                umin, umax = maximum(i - rmin - 1, 0),\
                             minimum(i + rmin + 2, self.nelx + 1)
                for j in xrange(self.nely):
                    vmin, vmax = maximum(j - rmin - 1, 0),\
                                 minimum(j + rmin + 2, self.nely + 1)
                    for k in xrange(self.nelz):
                        wmin, wmax = maximum(k - rmin3 - 1, 0),\
                                     minimum(k + rmin3 + 2, self.nelz + 1)
                        u = U[umin:umax, vmin:vmax, wmin:wmax]
                        v = V[umin:umax, vmin:vmax, wmin:wmax]
                        w = W[umin:umax, vmin:vmax, wmin:wmax]
                        dist = self.filtrad - sqrt((i - u) ** 2 + (j - v) **\
                               2 + (k - w) ** 2)
                        sumnumr = (maximum(0, dist) * self.desvars[w, v, u] *\
                                  self.df[w, v, u]).sum()
                        sumconv = maximum(0, dist).sum()
                        tmp[k, j, i] = sumnumr/(sumconv *\
                        self.desvars[k, j, i])

        self.df = tmp


    def update_desvars_oc(self):
        """
        Update the design variables by means of OC-like or equivalently SAO
        method, using the filtered sensitivities; return the updated design
        variables.

        EXAMPLES:
            >>> t.update_desvars_oc()

        See also: sens_analysis, filter_sens_sigmund

        """
        if not self.topydict:
            raise ToPyError('You must first load a TPD file!')
        # 'p' stays constant for a specified number of iterations from start.
        # 'p' is incremented, but not more than the maximum allowable value.
        # If continuation parameters are not specified in the input file, 'p'
        # will stay constant:
        if self.pcount >= self._phold:
            if (self.p + self._pincr) < self._pmax + self._pincr:
                if (self.pcount - self._phold) % self._pcon == 0:
                    self.p += self._pincr

        if self.qcount >= self._qhold:
            if (self.q + self._qincr) < self._qmax:
                if (self.qcount - self._qhold) % self._qcon == 0:
                    self.q += self._qincr

        self.pcount += 1
        self.qcount += 1

        # Exponential approximation of eta (damping factor):
        if self.itercount > 1:
            if self.topydict['ETA'] == 'exp': #  Check TPD specified value
                mask = equal(self.desvarsold / self.desvars, 1)
                self.a = 1 + log2(abs(self.dfold / self.df)) / \
                log2(self.desvarsold / self.desvars + mask) + \
                mask * (self.a - 1)
                self.a = clip(self.a, A_LOW, A_UPP)
                self.eta = 1 / (1 - self.a)

        self.dfold = self.df.copy()
        self.desvarsold = self.desvars.copy()

        # Change move limit for compliant mechanism synthesis:
        if self.probtype == 'mech':
            move = 0.1
        else:
            move = 0.2
        lam1, lam2 = 0, 100e3
        dims = self.desvars.shape
        while (lam2 - lam1) / (lam2 + lam1) > 1e-8 and lam2 > 1e-40:
            lammid = 0.5 * (lam1 + lam2)
            if self.probtype == 'mech':
                if self.approx == 'dquad':
                    curv = - 1 / (self.eta * self.desvars) * self.df
                    beta = maximum(self.desvars-(self.df + lammid)/curv, VOID)
                    move_upper = minimum(move, self.desvars / 3)
                    desvars = maximum(VOID, maximum((self.desvars - move),\
                    minimum(SOLID,  minimum((self.desvars + move), \
                    (self.desvars * maximum(1e-10, \
                    (-self.df / lammid))**self.eta)**self.q))))
                else:  # reciprocal or exponential
                    desvars = maximum(VOID, maximum((self.desvars - move),\
                    minimum(SOLID,  minimum((self.desvars + move), \
                    (self.desvars * maximum(1e-10, \
                    (-self.df / lammid))**self.eta)**self.q))))
            else:  # compliance or heat
                if self.approx == 'dquad':
                    curv = - 1 / (self.eta * self.desvars) * self.df
                    beta = maximum(self.desvars-(self.df + lammid)/curv, VOID)
                    move_upper = minimum(move, self.desvars / 3)
                    desvars = maximum(VOID, maximum((self.desvars - move),\
                    minimum(SOLID,  minimum((self.desvars + move_upper), \
                    beta**self.q))))
                else:  # reciprocal or exponential
                    desvars = maximum(VOID, maximum((self.desvars - move),\
                    minimum(SOLID,  minimum((self.desvars + move), \
                    (self.desvars * (-self.df / lammid)**self.eta)**self.q))))

            # Check for passive and active elements, modify updated x:
            if self.pasv.any() or self.actv.any():
                flatx = desvars.flatten()
                idx = []
                if self.nelz == 0:
                    y, x = dims
                    for j in range(x):
                        for k in range(y):
                            idx.append(k*x + j)
                else:
                    z, y, x = dims
                    for i in range(z):
                        for j in range(x):
                            for k in range(y):
                                idx.append(k*x + j + i*x*y)
                if self.pasv.any():
                    pasv = take(idx, self.pasv) #  new indices
                    put(flatx, pasv, VOID) #  = zero density


                #
                #
                #################### CONSTRUCTION AREA BEGINS ####################
                #
                #
                slope = 32
                # cutoff = self.cutoff
                min_cutoff = 0.05;
                try:
                    self.cutoffprinted
                except:
                    print '[xac] again, cutoff is', self.cutoff
                    print '[xac] and, slope is ', slope
                    self.cutoffprinted = True

                # if len(self.df_disfavored) > 0:
                #     desvars = flatx.reshape(dims)
                #     for k in xrange(0, self.nelz):
                #         for j in xrange(0, self.nely):
                #             for i in xrange(0, self.nelx):
                #                 df_val = self.df_disfavored[i][j]
                #                 cutoff = self.cutoff
                #                 tr_df = self.sigmoid(df_val, slope, cutoff)
                #                 tr_min = self.sigmoid(0, slope, cutoff)
                #                 tr_max = self.sigmoid(1, slope, cutoff)
                #                 tr_df = (tr_df - tr_min) / (tr_max - tr_min)
                #                 desvars[k, j, i] = max(VOID, desvars[k, j, i] * tr_df)
                #     flatx = desvars.flatten()

                if len(self.df_favored) > 0:
                    desvars = flatx.reshape(dims)
                    for k in xrange(0, self.nelz):
                        for j in xrange(0, self.nely):
                            for i in xrange(0, self.nelx):
                                df_val = self.df_favored[i][j]
                                try:
                                    stress = self.stress[i][j][k]
                                    cutoff = self.cutoff # * math.exp(stress)

                                    # print cutoff, self.cutoff
                                    tr_df = self.sigmoid(df_val, slope, cutoff)
                                    tr_min = self.sigmoid(0, slope, cutoff)
                                    tr_max = self.sigmoid(1, slope, cutoff)

                                    # HACK: ignore non-favored elements for now
                                    tr_df = (tr_max - tr_df) / (tr_max - tr_min)
                                    desvars[k, j, i] = min(SOLID, desvars[k, j, i] * tr_df)
                                    desvars[k, j, i] = max(VOID, desvars[k, j, i])
                                except:
                                    # print '[xac] updating favored elements exception'
                                    continue
                    flatx = desvars.flatten()

                #
                #
                ####################  CONSTRUCTION AREA ENDS  ####################
                #
                #

                if self.actv.any():
                    actv = take(idx, self.actv) #  new indices
                    put(flatx, actv, SOLID) #  = solid
                desvars = flatx.reshape(dims)

            if self.nelz == 0:
                if desvars.sum() - self.nelx * self.nely * self.volfrac > 0:
                    lam1 = lammid
                else:
                    lam2 = lammid
            else:
                if desvars.sum() - self.nelx * self.nely * self.nelz *\
                self.volfrac > 0:
                    lam1 = lammid
                else:
                    lam2 = lammid
        self.lam = lammid

        self.desvars = desvars

        # Change in design variables:
        self.change = (abs(self.desvars - self.desvarsold)).max()

        # Solid-void fraction:
        nr_s = self.desvars.flatten().tolist().count(SOLID)
        nr_v = self.desvars.flatten().tolist().count(VOID)
        self.svtfrac = (nr_s + nr_v) / self.desvars.size


    # ===================================
    # === Private methods and helpers ===
    # ===================================
    def _updateK(self, K):
        """
        Update the global stiffness matrix by looking at each element's
        contribution i.t.o. design domain density and the penalisation factor.
        Return unconstrained stiffness matrix.

        """
        if self.nelz == 0: #  2D problem
            for elx in xrange(self.nelx):
                for ely in xrange(self.nely):
                    e2sdofmap = self.e2sdofmapi + self.dofpn *\
                    (ely + elx * (self.nely + 1))
                    if self.probtype == 'comp' or self.probtype == 'mech':
                        updatedKe = self.desvars[ely, elx] ** self.p * self.Ke
                    elif self.probtype == 'heat':
                        updatedKe = (VOID + (1 - VOID) * \
                        self.desvars[ely, elx] ** self.p) * self.Ke
                    mask = ones(e2sdofmap.size, dtype=int)
                    K.update_add_mask_sym(updatedKe, e2sdofmap, mask)
        else: #  3D problem
            for elz in xrange(self.nelz):
                for elx in xrange(self.nelx):
                    for ely in xrange(self.nely):
                        e2sdofmap = self.e2sdofmapi + self.dofpn *\
                                    (ely + elx * (self.nely + 1) + elz *\
                                    (self.nelx + 1) * (self.nely + 1))
                        if self.probtype == 'comp' or self.probtype == 'mech':
                            updatedKe = self.desvars[elz, ely, elx] ** \
                            self.p * self.Ke
                        elif self.probtype == 'heat':
                            updatedKe = (VOID + (1 - VOID) * \
                            self.desvars[elz, ely, elx] ** self.p) * self.Ke
                        mask = ones(e2sdofmap.size, dtype=int)
                        K.update_add_mask_sym(updatedKe, e2sdofmap, mask)

        K.delete_rowcols(self._rcfixed) #  Del constrained rows and columns
        return K

    #
    #   [xac] compute distance field (2d)
    #
    def get_distance_field(self, elms, elm_vals, nelx, nely):
        infinity = 1e6
        epsilon = 1e-6
        df = []
        inc = []
        min_inc = 0.01

        # initialize distance field
        for i in xrange(0, nelx):
            row = []
            for j in xrange(0, nely):
                row.append(infinity)
            df.append(row)

        # initialize distance field incrementals
        for i in xrange(0, nelx):
            row = []
            for j in xrange(0, nely):
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
            mpz = int(math.floor(elm_num / (nelx * nely)))
            mpx = int(math.floor((elm_num - mpz * (nelx * nely)) / nely))
            mpy = int(math.floor(elm_num - mpz * (nelx * nely) - mpx * nely))
            df[mpx][mpy] = 0
            inc[mpx][mpy] = min_inc + elm_vals[idx] * (1 - min_inc)
            buf_prev.append([mpx, mpy])
            buf_all.append([mpx, mpy])
            idx += 1

        cnt = 0
        for i in xrange(0, nelx):
            for j in xrange(0, nely):
                cnt += 1 if df[i][j] != infinity else 0

        while cnt < num:
            buf = []
            for idx in buf_prev:
                val_df = df[idx[0]][idx[1]]
                val_inc = inc[idx[0]][idx[1]]
                for didx in neighbors:
                    ii = idx[0] + didx[0]
                    jj = idx[1] + didx[1]
                    if 0<=ii and ii<nelx and 0<=jj and jj<nely:
                        if df[ii][jj] == infinity:
                            df[ii][jj] = val_df + val_inc
                            inc[ii][jj] = min(1, val_inc * 1.1)
                            max_val = max(df[ii][jj], max_val)
                            buf.append([ii, jj])
                            cnt += 1

            buf_prev = list(buf)


        ### normalize
        max_val *= 1.0
        for i in xrange(0, nelx):
            for j in xrange(0, nely):
                df[i][j] /= max_val
                df[i][j] = max(epsilon, df[i][j])

        # print df
        # print max_val
        # print num, cnt, len(df), len(df[0]), elms.size
        return df

    # 1 - (1/(1+e^(64*(0.1-x)))-0.039)/(1-0.039)
    def sigmoid(self, t, slope, cutoff):
        return 1 / (1 + math.exp(slope*(cutoff-t)))
# EOF topology.py

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	Optimization - prepare for and communicate with optimization engine
 * 	
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

// check dependencies
if (XAC.Thing == undefined || XAC.Utilities == undefined || XAC.Const == undefined) {
	err('missing dependency!');
}

FORTE.Optimization = function(scene) {};

FORTE.Optimization.prototype = {
	constructor: FORTE.Optimization
};

FORTE.Optimization.p = 3; // for now, hard coded

FORTE.Optimization.elm2nodes = function(nelx, nely, nelz, mpx, mpy, mpz) {
	var innback = [0, 1, nely + 1, nely + 2];
	var enback = nely * (mpx - 1) + mpy;

	var nnback = addScalar(innback, enback + mpx - 1);
	var nnfront = addScalar(nnback, (nelx + 1) * (nely + 1));
	var nn = addScalar(nnfront.concat(nnback), (mpz - 1) * (nelx + 1) * (nely + 1));
	// log('Node numbers for ' + nelx + 'x' + nely + 'x' + nelz + ' 3D element at position x = ' + mpx + ',' + ' y = ' + mpy + ' and z = ' + mpz + ' :\n' + nn);
	// log('Element number = ' + (enback + nelx * nely * (mpz - 1)));
	// log('Highest node number in domain = ' + ((nelx + 1) * (nely + 1) * (nelz + 1)));
	return nn;
};

//
//	retrieve all elements that are connected to a given node
//
FORTE.Optimization.node2elms = function(nelx, nely, nelz, idx) {
	var noz = XAC.float2int(idx / ((nelx + 1) * (nely + 1)));
	var nox = XAC.float2int((idx - noz * (nelx + 1) * (nely + 1)) / (nely + 1));
	var noy = XAC.float2int(idx - noz * (nelx + 1) * (nely + 1) - nox * (nely + 1));

	var elms = [];
	for (var i = nox - 1; i < nox + 1; i++) {
		for (var j = noy - 1; j < noy + 1; j++) {
			for (var k = noz - 1; k < noz + 1; k++) {
				if (0 <= i && i < nelx && 0 <= j && j < nely && 0 <= k && k < nelz) {
					elms.push([i, j, k]);

					////////////////////////////////////////////////////////////////////////////////
					// testing
					var nn = FORTE.Optimization.elm2nodes(nelx, nely, nelz, i + 1, j + 1, k + 1);
					var nodeNonExisting = true;
					for (var h = nn.length - 1; h >= 0; h--) {
						if (nn[h] == idx + 1) {
							nodeNonExisting = false;
							break;
						}
					}
					if (nodeNonExisting) {
						err('error at node ' + idx)
					}
					////////////////////////////////////////////////////////////////////////////////
				}
			}
		}
	}

	return elms;
};

//
// subroutine for adding a scalar to each element in an array
//
function addScalar(array, s) {
	var array2 = [];
	for (var i = array.length - 1; i >= 0; i--) {
		array2.push(array[i] + s);
	}
	return array2;
}
/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	Visualizer - contains a collection of visualization techniques
 *
 *	@author Xiang 'Anthonj' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

// check dependencies
if (XAC.Thing == undefined || XAC.Utilities == undefined || XAC.Const ==
	undefined) {
	err('missing dependency!');
}

FORTE.Visualizer = function(scene) {
	this._scene = scene;
	this._arrows = [];
	this._visualElements = [];

	// yield strength, https://en.wikipedia.org/wiki/Ultimate_tensile_strength
	this._yieldStrength = Math.pow(40.0, 1.5);
};

FORTE.Visualizer.prototype = {
	constructor: FORTE.Visualizer
};

//
//	compute displacement for each element of a voxel grid
//
FORTE.Visualizer.prototype._computeDisplacement = function(listDisp, vxg) {
	var nelx = vxg.nx;
	var nely = vxg.ny;
	var nelz = vxg.nz;

	var arrDisp = listDisp.split(',');

	// initialize displacement arrays for the elements
	var dispElms = [];
	for (var i = 0; i < nelx; i++) {
		var plane = [];
		for (var j = 0; j < nely; j++) {
			var line = [];
			for (var k = 0; k < nelz; k++) {
				line.push([]);
			}
			plane.push(line)
		}
		dispElms.push(plane);
	}

	// collect displacement vector for corresponding elements
	for (var i = 0; i + 2 < arrDisp.length; i += 3) {
		var dispNode = new THREE.Vector3(Number(arrDisp[i]), Number(arrDisp[i + 1]),
			Number(arrDisp[i + 2]));
		elmsOfNode = FORTE.Optimization.node2elms(nelx, nely, nelz, i / 3);
		for (var j = elmsOfNode.length - 1; j >= 0; j--) {
			var idxElm = elmsOfNode[j];
			var disps = dispElms[idxElm[0]][idxElm[1]][idxElm[2]];
			disps.push(dispNode);
		}
	}

	// obtain the average displacement vector for each element
	for (var i = 0; i < nelx; i++) {
		for (var j = 0; j < nely; j++) {
			for (var k = 0; k < nelz; k++) {
				var vdisp = new THREE.Vector3();
				for (var h = dispElms[i][j][k].length - 1; h >= 0; h--) {
					vdisp.add(dispElms[i][j][k][h]);
				}
				vdisp.divideScalar(dispElms[i][j][k].length);

				// take into account the penalty
				var xe = vxg.gridRaw[k][j][i]; // density at this voxel
				vdisp.multiplyScalar(Math.pow(xe, FORTE.Optimization.p)); // multiplied by penalty

				dispElms[i][j][k] = []; // release the original array
				dispElms[i][j][k] = vdisp; // assign the displacement vector
			}
		}
	}

	return dispElms;
}

//
//	visualize displacement vector:
//	@param 	listDisp - a list of displacement values (raw)
//	@param 	vxg - the corresponding voxel grid
//
FORTE.Visualizer.prototype.visualizeDisplacement = function(listDisp, vxg) {
	var nelx = vxg.nx;
	var nely = vxg.ny;
	var nelz = vxg.nz;

	var dispElms = this._computeDisplacement(listDisp, vxg);

	// clean up existing visualization
	for (var i = this._arrows.length - 1; i >= 0; i--) {
		this._scene.remove(this._arrows[i]);
	}
	this._arrows = [];

	// normalize the forces by a customize worst case displacement
	var worstDisp = Math.sqrt(nelx * nelx + nely * nely + nelz * nelz) / 2;
	for (var i = 0; i < nelx; i++) {
		for (var j = 0; j < nely; j++) {
			for (var k = 0; k < nelz; k++) {
				var pos = new THREE.Vector3(i, j, k).multiplyScalar(vxg.dim);
				var arrow = addAnArrow(pos, dispElms[i][j][k], vxg.dim, 1);

				for (var h = arrow.children.length - 1; h >= 0; h--) {
					arrow.children[h].material.color = this._getHeatmapColor(dispElms[i][j][k]
						.length(), worstDisp);
					arrow.children[h].material.opacity = vxg.gridRaw[k][j][i];
					arrow.children[h].material.needsUpdate = true;
				}

				this._arrows.push(arrow);
			} // z
		} // y
	} // x
}

//
//	compute stress for each voxel element, which is divided into 6 tetrahedrons
//
FORTE.Visualizer.prototype._computeStress = function(listDisp, vxg) {
	var nelx = vxg.nx;
	var nely = vxg.ny;
	var nelz = vxg.nz;

	var arrDisp = listDisp.split(',');

	var tetraGrid = [];
	var stressData = [];
	for (var i = 0; i < nelx; i++) {
		var plane = [];
		for (var j = 0; j < nely; j++) {
			var line = [];
			for (var k = 0; k < nelz; k++) {
				var ns = FORTE.Optimization.elm2nodes(nelx, nely, nelz, i + 1, j + 1, k +
					1);
				var tetras = [];

				// the compositions of tetrahedrons of a cube
				var tetraIndices = [
					[7, 0, 5, 6],
					[0, 1, 6, 4],
					[0, 6, 4, 5],
					[2, 0, 3, 5],
					[0, 1, 4, 3],
					[0, 3, 4, 5]
				];

				// init the tetrahedral data structure
				for (var h = 0; h < tetraIndices.length; h++) {
					var idxTetra = tetraIndices[h];
					var idxNodes = [ns[idxTetra[0]] - 1, ns[idxTetra[1]] - 1, ns[idxTetra[2]] -
						1, ns[idxTetra[3]] - 1
					];
					var positions = [];
					var displacements = [];

					for (var l = 0; l < idxNodes.length; l++) {
						var idx = idxNodes[l];
						displacements.push(new THREE.Vector3(Number(arrDisp[idx * 3]), Number(
							arrDisp[idx * 3 + 1]), Number(arrDisp[idx * 3 + 2])));

						var z = XAC.float2int(idx / (nelx + 1) / (nely + 1));
						var x = XAC.float2int((idx - z * (nelx + 1) * (nely + 1)) / (nely + 1));
						var y = nely - XAC.float2int(idx - z * (nelx + 1) * (nely + 1) - x * (
							nely + 1));
						positions.push(new THREE.Vector3(x, y, z));
					}

					var xe = vxg.gridRaw[k][j][i];
					var stress = this._computeTetraStress(positions, displacements); // * Math.pow(xe, FORTE.Optimization.p);

					tetras.push({
						idxNodes: idxNodes,
						positions: positions,
						stress: stress
					});

					stressData.push(stress);
				}
				line.push(tetras);
			}
			plane.push(line)
		}
		tetraGrid.push(plane);
	}

	var avgStress = XAC.getAvg(stressData);
	var stdStress = XAC.getStd(stressData);
	var maxStress = avgStress + 3 * stdStress;
	log({
		avgStress: avgStress,
		stdStress: stdStress,
		maxStress: maxStress
	});

	return {
		tetraGrid: tetraGrid,
		maxStress: maxStress
	};
}

//
//	compute stress for a given tetrahedron
//
FORTE.Visualizer.prototype._computeTetraStress = function(positions,
	displacements) {
	var node = positions[0].clone();
	var node1 = positions[1].clone();
	var node2 = positions[2].clone();
	var node3 = positions[3].clone();

	var v1 = new THREE.Vector3().subVectors(node1, node);
	var v2 = new THREE.Vector3().subVectors(node2, node);
	var v3 = new THREE.Vector3().subVectors(node3, node);

	node.add(displacements[0]);
	node1.add(displacements[1]);
	node2.add(displacements[2]);
	node3.add(displacements[3]);

	var V1 = new THREE.Vector3().subVectors(node1, node);
	var V2 = new THREE.Vector3().subVectors(node2, node);
	var V3 = new THREE.Vector3().subVectors(node3, node);

	var E = this._computeGreenStrain(v1, v2, v3, V1, V2, V3);
	return numeric.fnorm(E);
};

//
//	visualize stress based on a voxel grid
//
FORTE.Visualizer.prototype.visualizeStress = function(listDisp, vxg) {
	var stressInfo = this._computeStress(listDisp, vxg);
	var tetraGrid = stressInfo.tetraGrid;
	var maxStress = stressInfo.maxStress;

	var nelx = vxg.nx;
	var nely = vxg.ny;
	var nelz = vxg.nz;
	var diag = Math.sqrt(nelx * nelx + nely * nely + nelz * nelz);
	var normalizeFactor = this._yieldStrength; // * diag / (FORTE.MedialAxis.DEFAULTEDGERADIUS * 2);

	// vxg.hide();

	// faces of a tetrahedron
	// var faces = [new THREE.Face3(0, 1, 2),
	// 	new THREE.Face3(0, 1, 3),
	// 	new THREE.Face3(0, 2, 3),
	// 	new THREE.Face3(1, 2, 3)
	// ];

	for (var i = 0; i < nelx; i++) {
		for (var j = 0; j < nely; j++) {
			for (var k = 0; k < nelz; k++) {
				var tetras = tetraGrid[i][j][k];
				var stressElm = 0;
				for (var h = 0; h < tetras.length; h++) {
					stressElm = Math.max(stressElm, tetras[h].stress);
				} // tetra

				var alpha = 0.25;
				var mat = new THREE.MeshBasicMaterial({
					color: this._getHeatmapColor(stressElm, normalizeFactor), // maxStress),
					transparent: true,
					opacity: vxg.gridRaw[k][j][i] * (0.75 - alpha) + alpha,
					side: THREE.DoubleSide
				});

				// TODO: store the visualization elements
				// TEMP: debugging
				var elm = vxg._makeVoxel(vxg.dim, i + nelx * 1.5, j, k, mat, true);
				this._scene.add(elm);
				this._visualElements.push(elm);

			} // z
		} // y
	} // x
}

FORTE.Visualizer.prototype.visualizeStressInVivo = function(listDisp, vxg,
	meshes) {
	var stressInfo = this._computeStress(listDisp, vxg);
	var tetraGrid = stressInfo.tetraGrid;

	var dimVoxel = vxg.dim;
	var origin = vxg.origin;
	var nelx = vxg.nx;
	var nely = vxg.ny;
	var nelz = vxg.nz;
	var diag = Math.sqrt(nelx * nelx + nely * nely + nelz * nelz);
	var normalizeFactor = this._yieldStrength; // * diag / (5 * 2);
	log('normalizeFactor: ' + normalizeFactor)

	for (var i = 0; i < meshes.length; i++) {
		var mesh = meshes[i];
		mesh.material = new THREE.MeshBasicMaterial({
			vertexColors: THREE.VertexColors,
			transparent: true,
			opacity: 1
		});
		// mesh.material.needsUpdate = true;
		mesh.geometry.dynamic = true;
		var gt = XAC.getTransformedGeometry(mesh);

		for (var j = 0; j < mesh.geometry.faces.length; j++) {
			var face = mesh.geometry.faces[j];
			var vindices = [face.a, face.b, face.c];
			var posFace = new THREE.Vector3();
			for (var k = 0; k < vindices.length; k++) {
				posFace.add(gt.vertices[vindices[k]]);
			}
			posFace.divideScalar(vindices.length);

			var iv = XAC.clamp(XAC.float2int((posFace.x - origin.x) / dimVoxel), 0,
				nelx - 1);
			var jv = XAC.clamp(XAC.float2int((posFace.y - origin.y) / dimVoxel), 0,
				nely - 1);
			var kv = XAC.clamp(XAC.float2int((posFace.z - origin.z) / dimVoxel), 0,
				nelz - 1);

			var tetras = tetraGrid[iv][jv][kv];

			// TODO: figure out whether should take max or avg of stress
			var stressElm = 0;
			for (var h = 0; h < tetras.length; h++) {
				stressElm = Math.max(stressElm, tetras[h].stress);
			} // tetra

			var color = this._getHeatmapColor(stressElm, normalizeFactor);
			// addABall(this._scene, posFace, color, 3, 1)
			face.color.copy(color);
		}

		mesh.geometry.colorsNeedUpdate = true;
		// mesh.materialPersistent = mesh.material;
	}
}

//
//	compute green strain
//
FORTE.Visualizer.prototype._computeGreenStrain = function(v1, v2, v3, V1, V2,
	V3) {
	var U = [v1.toArray(), v2.toArray(), v3.toArray()];
	var W = [V1.toArray(), V2.toArray(), V3.toArray()];
	var F = numeric.dot(W, numeric.inv(U));
	// E = 1/2 (F^T * F - I)
	var E = numeric.times(numeric.sub(numeric.dot(numeric.transpose(F), F),
		numeric.identity(3)), 0.5);
	return E;
}

//
//	get heatmap like color based on -
//	@param	score
//	@param	maxScore
//
FORTE.Visualizer.prototype._getHeatmapColor = function(score, maxScore) {
	// ceiling the score by maxScore
	score = Math.min(score, maxScore);

	// var colorSchemes = [0xd7191c, 0xfdae61, 0xffffbf, 0xa6d96a, 0x1a9641];
	// var colorSchemes = [0xd73027, 0xf46d43, 0xfdae61, 0xfee08b, 0xffffbf,
	// 	0xd9ef8b, 0xa6d96a, 0x66bd63, 0x1a9850
	// ]
	var colorSchemes = [0xa50026, 0xd73027, 0xf46d43, 0xfdae61, 0xfee08b,
		0xffffbf, 0xd9ef8b, 0xa6d96a, 0x66bd63, 0x1a9850, 0x006837
	]
	colorSchemes.reverse(); // EXP
	var color = new THREE.Color(0xffffff);
	for (var k = 0; k < colorSchemes.length; k++) {
		if (score <= maxScore * (k + 1) / colorSchemes.length) {
			color.setHex(colorSchemes[k]);
			break;
		}
	}
	return color;
}

FORTE.Visualizer.prototype.clear = function() {
	for (var i = 0; i < this._visualElements.length; i++) {
		this._scene.remove(this._visualElements[i]);
	}
}

//
//	SEVERAL EXTENSION OF NUMERIC LIBRARY
//	@author Xiang 'Anthonj' Chen http://xiangchen.me
//

// compute the Frobenius norm of a matrix
numeric.fnorm = function(matrix) {
	var sum = 0;
	for (var i = 0; i < matrix.length; i++) {
		for (var j = 0; j < matrix[i].length; j++) {
			sum += Math.pow(matrix[i][j], 2);
		}
	}
	return Math.sqrt(sum);
}

// print a matrix
numeric.print = function(matrix) {
	for (var i = 0; i < matrix.length; i++) {
		log(matrix[i]);
	}
}

// times a matrix (including vector) by a scalar
numeric.times = function(matrix, scalar) {
	for (var i = 0; i < matrix.length; i++) {
		for (var j = 0; j < matrix[i].length; j++) {
			matrix[i][j] *= scalar;
		}
	}
	return matrix;
}

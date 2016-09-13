/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	voxel grid
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

FORTE.VoxelGrid = function(scene, origin) {
	this._scene = scene;
	this._origin = origin;

	this._voxels = [];
	this._table = [];

	this._dump = [];
}

FORTE.VoxelGrid.prototype = {
	constructor: FORTE.VoxelGrid,

	get grid() {
		return this._grid;
	},

	// dimension of a voxel
	get dim() {
		return this._dim;
	},

	get voxels() {
		return this._voxels;
	},

	get table() {
		return this._table;
	},

	get nx() {
		return this._nx;
	},

	get ny() {
		return this._ny;
	},

	get nz() {
		return this._nz;
	},

	get gridRaw() {
		return this._gridRaw;
	},

	get origin() {
		return this._origin;
	}
};

FORTE.VoxelGrid.prototype.load = function(vxgRaw, dim) {
	this._grid = [];
	this._gridRaw = [];
	this._dim = dim;

	// reading voxel info from vxgRaw file object
	var vxgRawSlices = vxgRaw.split('\n\n');
	for (var i = 0; i < vxgRawSlices.length; i++) {
		var sliceRaw = [];
		var slice = [];
		var vxgRawRows = vxgRawSlices[i].split('\n');
		for (var j = 0; j < vxgRawRows.length; j++) {
			var row = vxgRawRows[j].split(',');
			var rowRaw = []
				// binarize it
			for (var k = 0; k < row.length; k++) {
				rowRaw.push(row[k]);
				row[k] = row[k] >= 1 ? 1 : 0;
			}

			// for reasons i can't explain ...
			// row.reverse();
			// rowRaw.reverse();

			sliceRaw.push(rowRaw);
			slice.push(row);
		}
		this._gridRaw.push(sliceRaw);
		this._grid.push(slice);
	}

	this._nz = this._grid.length;
	this._ny = this._grid[0].length;
	this._nx = this._grid[0][0].length;

	return this._grid;
}

FORTE.VoxelGrid.prototype.render = function(hideInside) {
	for (var i = 0; i < this._nz; i++) {
		this._table[i] = this._table[i] == undefined ? [] : this._table[i];
		for (var j = 0; j < this._ny; j++) {
			this._table[i][j] = this._table[i][j] == undefined ? [] : this._table[i][j];
			// var row = [];
			for (var k = 0; k < this._nx; k++) {
				// row[k] = undefined;
				if (this._grid[i][j][k] == 1 && this._table[i][j][k] == undefined) {
					if (hideInside != true || this._onSurface(i, j, k)) {
						var voxel = this._makeVoxel(this._dim, k, j, i, new THREE.MeshLambertMaterial({
							color: 0x000000,
							transparent: true,
							wireframe: true,
							opacity: 0.75
						}), true);
						voxel.index = [k, j, i];
						// log(voxel.position.toArray())
						// log(voxel.position.toArray())
						// log('---')
						this._scene.add(voxel);
						// row[k] = voxel;
						// this._grid[i][j][k].idxMesh = gVoxels.length; // store the voxel's index in gVoxels
						this._voxels.push(voxel);
						this._table[i][j][k] = voxel;
					}
				} else if (this._grid[i][j][k] != 1 && this._table[i][j][k] != undefined) {
					var voxel = this._table[i][j][k];
					this._scene.remove(voxel);
					XAC.removeFromArray(this._voxels, voxel);
					this._table[i][j][k] = undefined;
				}
			} // x
		} // y
	} // z

	log(this._voxels.length + " voxels added.");
}

FORTE.VoxelGrid.prototype.updateToMedialAxis = function(axis, node) {
	//
	// update the entire voxel grid based on the axis
	//
	if (node == undefined) {
		// clear existing voxels
		// var nz = this._grid.length;
		// var ny = this._grid[0].length;
		// var nx = this._grid[0][0].length;

		for (var i = 0; i < this._nz; i++) {
			// EXP: only deal with 2D for now
			for (var j = 0; j < this._ny; j++) {
				for (var k = 0; k < this._nx; k++) {
					this._grid[i][j][k] = 0;
				}
			}
		}

		// for each node, add voxels around it
		for (var i = axis.nodesInfo.length - 1; i >= 0; i--) {
			var v = axis.nodesInfo[i].mesh.position;
			var radius = axis.nodesInfo[i].radius;
			// this._grid[index[2]][index[1]][index[0]] = axis.NODE;
			if (radius != undefined) {
				this._addSphericalVoxels(v, radius);
			}
		}

		// for each edge, add voxels along it
		for (var i = axis.edgesInfo.length - 1; i >= 0; i--) {
			var v1 = axis.edgesInfo[i].v1.mesh.position;
			var v2 = axis.edgesInfo[i].v2.mesh.position;
			var pts = axis.edges[i];
			var thickness = axis.edgesInfo[i].thickness; // assume the thickness array has been re-interpolated

			if (thickness == undefined || thickness.length <= 0) {
				continue;
			}

			for (var j = thickness.length - 1; j >= 0; j--) {
				// var k = XAC.float2int(j * thickness.length / pts.length);
				var v = v1.clone().multiplyScalar(1 - j * 1.0 / thickness.length).add(
					v2.clone().multiplyScalar(j * 1.0 / thickness.length)
				);
				this._addSphericalVoxels(v, thickness[j]);
			}
		}

		// re-render the voxel grid
		// for (var i = gVoxels.length - 1; i >= 0; i--) {
		// 	this._scene.remove(gVoxels[i]);
		// }
		this.render(false);
		// axis.renderAxis();
	}
	//
	// only update one node and its associated edges
	//
	else {
		// TODO
	}
}

FORTE.VoxelGrid.prototype.hide = function() {
	for (var i = this._voxels.length - 1; i >= 0; i--) {
		this._scene.remove(this._voxels[i]);
	}
}

FORTE.VoxelGrid.prototype.show = function() {
	for (var i = this._voxels.length - 1; i >= 0; i--) {
		this._scene.add(this._voxels[i]);
	}
}


FORTE.VoxelGrid.prototype._onSurface = function(i, j, k) {
	return i * j * k == 0 || (nz - 1 - i) * (ny - 1 - j) * (nx - 1 - k) == 0 ||
		this._grid[i - 1][j][k] != 1 || this._grid[i + 1][j][k] != 1 ||
		this._grid[i][j - 1][k] != 1 || this._grid[i][j + 1][k] != 1 ||
		this._grid[i][j][k - 1] != 1 || this._grid[i][j][k + 1] != 1;
}

FORTE.VoxelGrid.prototype._makeVoxel = function(dim, i, j, k, mat, noMargin) {
	var geometry = new THREE.BoxGeometry(dim, dim, dim);
	var voxel = new THREE.Mesh(geometry, mat.clone());

	// leave some margin between voxels
	if (noMargin) {} else {
		dim += 1
	}

	voxel.position.set(i * dim, j * dim, k * dim);

	if (this._origin != undefined) {
		voxel.position.copy(this._origin.clone().add(voxel.position))
	}

	this._dump.push(voxel);

	return voxel;
}

FORTE.VoxelGrid.prototype._addSphericalVoxels = function(v, radius) {
	var vxg = this._grid;

	var zmin = XAC.float2int((v.z - radius) / this._dim),
		zmax = XAC.float2int((v.z + radius) / this._dim),
		ymin = XAC.float2int((v.y - radius) / this._dim),
		ymax = XAC.float2int((v.y + radius) / this._dim),
		xmin = XAC.float2int((v.x - radius) / this._dim),
		xmax = XAC.float2int((v.x + radius) / this._dim);
	for (var z = zmin; z < zmax; z++) {
		vxg[z] = vxg[z] == undefined ? [] : vxg[z];
		for (var y = ymin; y < ymax; y++) {
			vxg[z][y] = vxg[z][y] == undefined ? [] : vxg[z][y];
			for (var x = xmin; x < xmax; x++) {
				var v0 = new THREE.Vector3(x, y, z).multiplyScalar(this._dim);
				if (v0.distanceTo(v) <= radius) {
					vxg[z][y][x] = 1;
				}
			}
		}
	}
};

FORTE.VoxelGrid.prototype.clear = function() {
	for (var i = 0; i < this._dump.length; i++) {
		this._scene.remove(this._dump[i]);
	}
	this._dump = [];
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *
 *	working with a medial axis
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

//
//	special method for working with a voxel grid:
//		snap the voxels in the voxel grid to this medial axis
//
//	@param	vxg - an FORTE.VoxelGrid object
//
FORTE.MedialAxis.prototype.snapVoxelGrid = function(vxg) {
	var visualize = true;
	this._voxelGrid = vxg;

	for (var i = vxg.voxels.length - 1; i >= 0; i--) {
		this._snapVoxel(vxg.voxels[i], vxg.dim);
	}

	// aggregating edges
	for (var h = this._edgesInfo.length - 1; h >= 0; h--) {
		var p1 = this._edgesInfo[h].v1.mesh.position;
		var p2 = this._edgesInfo[h].v2.mesh.position;
		var thicknessData = this._edgesInfo[h].thicknessData;

		if (thicknessData == undefined || thicknessData.length <= 0) {
			continue;
		}

		this._edgesInfo[h].thickness = new Array(thicknessData.length);
		var thickness = this._edgesInfo[h].thickness;

		for (var i = thickness.length - 1; i >= 0; i--) {
			var t = getMax(thicknessData[i]);

			if (isNaN(t) || t <= vxg.dim) {
				t = vxg.dim;
			}

			thickness[i] = t;
		}

		thicknessData = [];
	}

	// aggregating nodes
	for (var h = this._nodesInfo.length - 1; h >= 0; h--) {
		var rNode = getMax(this._nodesInfo[h].radiusData);
		rNode = rNode == undefined ? 0 : rNode;

		var rEdges = 0;
		var numEdges = 0;
		for (var i = this._nodesInfo[h].edgesInfo.length - 1; i >= 0; i--) {
			var edgeInfo = this._nodesInfo[h].edgesInfo[i];
			if (edgeInfo.deleted) {
				continue;
			}

			if (edgeInfo.thickness.length > 0) {
				var r = this._nodesInfo[h] == edgeInfo.v1 ?
					edgeInfo.thickness[0] : edgeInfo.thickness[edgeInfo.thickness.length - 1];
				rEdges += r;
				numEdges++;
			}
		}

		// averaged across all adjacent edges and the node itself
		this._nodesInfo[h].radius = (rEdges + rNode) / (numEdges + (rNode == 0 ? 0 :
			1));
		this._nodesInfo[h].radiusData = [];
	}

	// revoxelize based on this axis
	vxg.updateToMedialAxis(this);

	// render the medial axis with thickness
	this._render();
}


//
//	snap a voxel (of a dim dimension) to this medial axis
//
FORTE.MedialAxis.prototype._snapVoxel = function(voxel, dim) {
	var visualize = false;
	var v = voxel.position;

	//
	// snap to edge
	//
	var idxEdgeMin = -1;
	var dist2EdgeMin = Number.MAX_VALUE;
	var projEdgeMin = new THREE.Vector3();
	for (var h = this._edgesInfo.length - 1; h >= 0; h--) {
		var v1 = this._edgesInfo[h].v1.mesh.position;
		var v2 = this._edgesInfo[h].v2.mesh.position;

		var p2lInfo = p2ls(v.x, v.y, v.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
		if (p2lInfo != undefined) {
			var dist = p2lInfo.distance;
			var proj = p2lInfo.projection;
			if (dist < dist2EdgeMin) {
				idxEdgeMin = h;
				dist2EdgeMin = dist;
				projEdgeMin.set(proj[0], proj[1], proj[2]);
			}
		}
	}

	//
	// snap to node
	//
	var idxNodeMin = -1;
	var dist2NodeMin = Number.MAX_VALUE;
	for (var h = this._nodesInfo.length - 1; h >= 0; h--) {
		var dist = v.distanceTo(this._nodes[h].position);
		if (dist < dist2NodeMin) {
			idxNodeMin = h;
			dist2NodeMin = dist;
		}
	}

	//
	// compare the two
	//
	if (dist2EdgeMin < dist2NodeMin) {
		if (visualize) {
			addALine(v, projEdgeMin);
		}

		// register the distance to edge
		var v1 = this._edgesInfo[idxEdgeMin].v1.mesh.position;
		var v2 = this._edgesInfo[idxEdgeMin].v2.mesh.position;
		var thicknessData = this._edgesInfo[idxEdgeMin].thicknessData;
		if (thicknessData == undefined) {
			this._edgesInfo[idxEdgeMin].thicknessData = new Array(XAC.float2int(v2.distanceTo(
				v1) / dim));
			thicknessData = this._edgesInfo[idxEdgeMin].thicknessData;
		}

		var idxPt = XAC.float2int(projEdgeMin.distanceTo(v1) / dim);
		if (thicknessData[idxPt] == undefined) {
			thicknessData[idxPt] = [];
		}
		thicknessData[idxPt].push(dist2EdgeMin);

	} else {
		if (visualize) {
			var v0 = this._nodesInfo[idxNodeMin].mesh.position;
			addALine(v, v0);
		}

		// register the distance to node
		this._nodesInfo[idxNodeMin].radiusData.push(Math.max(this._nodesInfo[
			idxNodeMin].radius, dist2NodeMin));
	}
};

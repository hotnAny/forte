var XAC = XAC || {};

XAC.Thing = function(m) {
	this._g = undefined; // the original geometry, always!
	this._m = m;

	this._weight = undefined;
};

XAC.Thing.prototype = {
	constructor: XAC.Thing,

	get g() {
		return this._g;
	},

	get gt() {
		this._m.updateMatrixWorld();
		var gTransformed = this._g.clone();
		gTransformed.applyMatrix(this._m.matrixWorld);
		return gTransformed;
	},

	get m() {
		return this._m;
	},

	unitTest: function() {
		log(this.g);
	}
}

//
//	line
//
XAC.Line = function(p1, p2, clr) {
	this._g = new THREE.Geometry();
	this._g.vertices.push(p1);
	this._g.vertices.push(p2);
	clr = clr == undefined ? 0x000000 : clr;
	var mat = new THREE.LineBasicMaterial({
		color: clr
	});
	this._m = new THREE.Line(this._g, mat);
};
XAC.Line.prototype = Object.create(XAC.Thing.prototype);

//
//	thick line
//
XAC.ThickLine = function(p1, p2, r, mat) {
	var h = p1.distanceTo(p2);
	this._line = new XAC.Cylinder(r, h, mat, true);
	this._g = this._line.g;
	this._m = this._line.m;

	this._dir = p2.clone().sub(p1);
	XAC.rotateObjTo(this._m, this._dir);
	var ctr = p1.clone().add(p2).multiplyScalar(0.5);
	this._m.position.copy(ctr);

	this._r = r;
}
XAC.ThickLine.prototype = Object.create(XAC.Thing.prototype);
XAC.ThickLine.prototype.update = function(p1, p2, r) {
	var h = p1.distanceTo(p2);
	this._line.update(r, h, undefined, true);

	XAC.rotateObjTo(this._m, this._dir, true);
	this._dir = p2.clone().sub(p1);
	XAC.rotateObjTo(this._m, this._dir);

	var ctr = p1.clone().add(p2).multiplyScalar(0.5);
	this._m.position.copy(ctr);
}
XAC.ThickLine.prototype.updateEfficiently = function(p1, p2, r) {
	var dir = p2.clone().sub(p1);
	if (dir.length() > XAC.EPSILON && this._dir.length() > XAC.EPSILON) {
		// rotate back
		XAC.rotateObjTo(this._m, this._dir, true);

		// scale
		var yScale = dir.length() / this._dir.length();
		var xzScale = (r.r1 + r.r2) / (this._r.r1 + this._r.r2);
		scaleAroundVector(this._m, xzScale, new THREE.Vector3(0, 1, 0));
		scaleAlongVector(this._m, yScale, new THREE.Vector3(0, 1, 0));

		// rotate
		XAC.rotateObjTo(this._m, dir);

		this._r = r;
		this._dir = dir;
	}

	// reposition
	var ctr = p1.clone().add(p2).multiplyScalar(0.5);
	this._m.position.copy(ctr);
}

//
//	plane
//
XAC.Plane = function(w, l, mat) {
	this._g = new THREE.CubeGeometry(w, 1, l);
	this._m = new THREE.Mesh(this._g, mat == undefined ? XAC.MATERIALNORMAL.clone() :
		mat.clone());
}
XAC.Plane.prototype = Object.create(XAC.Thing.prototype);

//
//	sphere
//
XAC.Sphere = function(r, mat, highFi) {
	this._r = r;
	this._highFi = highFi;
	this._g = this._highFi == true ? new THREE.SphereBufferGeometry(r, 32, 32) : new THREE
		.SphereBufferGeometry(r, 8, 8);
	this._m = new THREE.Mesh(this._g, mat == undefined ? XAC.MATERIALNORMAL.clone() :
		mat.clone());
};
XAC.Sphere.prototype = Object.create(XAC.Thing.prototype);
XAC.Sphere.prototype.update = function(r, ctr) {
	if (r != undefined)
		this._m.geometry = this._highFi == true ? new THREE.SphereBufferGeometry(r, 32, 32) :
		new THREE.SphereBufferGeometry(r, 8, 8);
	if (ctr != undefined)
		this._m.position.copy(ctr);
}

//
// cylinder
//
XAC.Cylinder = function(r, h, mat, openEnded) {
	this.update(r, h, mat, openEnded)
}
XAC.Cylinder.prototype = Object.create(XAC.Thing.prototype);
XAC.Cylinder.prototype.update = function(r, h, mat, openEnded) {
	this._h = h;
	if (r.r1 != undefined && r.r2 != undefined) {
		this._r1 = r.r1;
		this._r2 = r.r2;
	} else {
		this._r1 = this._r2 = r;
	}

	// TODO: make sure the radius segment is enough for visualization
	this._g = new THREE.CylinderBufferGeometry(this._r1, this._r2, this._h, 8, 1,
		openEnded);
	if (this._m == undefined) {
		this._m = new THREE.Mesh(this._g, mat == undefined ? XAC.MATERIALNORMAL.clone() :
			mat.clone());
	} else {
		this._m.geometry = this._g;
	}
};

//
//	box
//
XAC.Box = function(w, t, l, mat) {
	this._material = mat;
	this.update(w, t, l, this._material);
}
XAC.Box.prototype = Object.create(XAC.Thing.prototype);
XAC.Box.prototype.update = function(w, t, l) {
	this._g = new THREE.CubeGeometry(w, t, l);
	this._m = new THREE.Mesh(this._g,
		this._material == undefined ? MATERIALNORMAL.clone() : this._material.clone()
	);
}

//
// 	polyhedron
//	@param vertices - an array of THREE.Vector3
//	@param faces - which vertices each face corresponds to
//
XAC.Polygon = function(vertices, faces, mat) {
	// var arrVertices = [];
	// for (var i = 0; i < vertices.length; i++) {
	// 	arrVertices = arrVertices.concat(vertices[i].toArray());
	// }

	// this._g = new THREE.PolyhedronGeometry(arrVertices, faces, 1)
	this._g = new THREE.Geometry();
	this._g.vertices = vertices;
	this._g.faces = faces;
	this._m = new THREE.Mesh(this._g, mat == undefined ? XAC.MATERIALNORMAL.clone() :
		mat.clone());
}
XAC.Polygon.prototype = Object.create(XAC.Thing.prototype);

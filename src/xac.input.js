/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	Input techniques - contains a collection of input techniques
 *
 *	@author Xiang 'Anthonj' Chen http://xiangchen.me
 *
 *	NOTE:
 *	> it assumes a global variable camera exists - might want to fix that
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var XAC = XAC || {};

XAC.IDLE = 0;
XAC.LEFTMOUSE = 1;
XAC.RIGHTMOUSE = 3;
XAC.WHEEL = 4;

//
//	a plane orthogonal to the camera for manipulation
//	@param	pos - the position of a point in R3
//	@param	orthogonal - whether to snap the plane to XZ or Y
//	@param	showPlane - whether to show the plane visually
//
XAC.Maniplane = function(pos, scene, camera, canvas, orthogonal, showPlane) {
	this._camera = camera;
	this._scene = scene;
	this._canvas = canvas;

	this._plane = new XAC.Plane(1000, 1000, showPlane == true ? XAC.MATERIALPLAIN :
		XAC.MATERIALINVISIBLE).m;
	this._plane.material.opacity = 0.5;
	this._plane.position.copy(pos);

	// var vecView = new THREE.Vector3().subVectors(this._camera.position, this._plane
		// .position);

	//HACK
	var vecView = new THREE.Vector3(0, 0, 1);

	if (orthogonal == true) {
		var angleView = new THREE.Vector3(0, 1, 0).angleTo(vecView);
		if (angleView > Math.PI / 3) {
			XAC.rotateObjTo(this._plane, vecView);
		}
	} else {
		XAC.rotateObjTo(this._plane, vecView);
	}

	this._scene.add(this._plane);
};

XAC.Maniplane.prototype = {
	update: function(e) {
		return XAC.hitPoint(e, [this._plane], this._camera, this._canvas);
	},

	setPosition: function(pos) {
		this._plane.position.copy(pos);
	},

	destruct: function() {
		this._scene.remove(this._plane);
		// this._plane.material.opacity = 0.25;
		// this._plane.material.needsUpdate = true;
	}
}

//
//	a sphere based selector for specifying a vector coming from the centroid
//	@param	pos - position to place the selector
//	@param	radius - how big should the sphere be
//
XAC.SphereSelector = function(pos, radius, scene, camera) {
	this._pos = pos;
	this._radius = radius;
	this._scene = scene;
	this._camera = camera;

	this._update = function() {
		this._scene.remove(this._sphere);
		this._sphere = new XAC.Sphere(this._radius, XAC.MATERIALINVISIBLE, true).m;
		this._sphere.position.copy(this._pos);
		this._scene.add(this._sphere);
	}
	this._update();
}

XAC.SphereSelector.prototype = {
	hitTest(e) {
			var intSphere = XAC.rayCast(e.clientX, e.clientY, [this._sphere], this._camera);
			if (intSphere[0] != undefined) {
				this._pt = intSphere[0].point;
				this._scene.remove(this._line);
				this._line = XAC.addAnArrow(this._scene, this._pos, this._pt.clone().sub(
					this._pos), this._radius * 1.5, 2.5);
			}
		},

		clear() {
			this._scene.remove(this._sphere);
			this._scene.remove(this._dot);
			this._scene.remove(this._line);
		},

		setRadius(radius) {
			this._radius = radius;
			this._update();
		},

		get selection() {
			return this._pt;
		},

		get pointer() {
			return this._line;
		}
}

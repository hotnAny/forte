/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	a forte design, consisting of
 *		- a user-created low-fi model (the geometry)
 *		- a series of functional requirments (the functions)
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

FORTE.Design = function(canvas, scene, camera) {
	this._scene = scene;
	this._camera = camera;
	this._canvas = canvas;

	this._mode = FORTE.Design.SKETCH;
	$(FORTE.canvasRenderer.domElement).css('cursor', 'crosshair');

	this._opacityFull = 1.0;
	this._opacityHalf = 0.5;

	// color scheme
	this._matDesign = new THREE.MeshBasicMaterial({
		color: XAC.COLORNORMAL,
		transparent: true,
		opacity: this._opacityFull
	});
	this._matLoad = new THREE.MeshLambertMaterial({
		color: XAC.COLORALT,
		transparent: true,
		opacity: this._opacityFull
	});
	this._matClearance = new THREE.MeshLambertMaterial({
		color: XAC.COLORCONTRAST,
		transparent: true,
		opacity: this._opacityFull
	});
	this._matBoundary = new THREE.MeshBasicMaterial({
		color: XAC.COLORCONTRAST,
		transparent: true,
		opacity: this._opacityFull
	});

	// using a medial axis to represent design
	this._medialAxis = new FORTE.MedialAxis(this._canvas, this._scene, this._camera);
	this._medialAxis._matNode = this._matDesign;
	this._medialAxis._matvisual = this._matDesign;
	this._medialAxis._matHighlight.opacity = 1;
	this._medialAxis.RESTORINGEDGE = false;

	// storing a list of functional parameters
	this._loads = [];
	this._clearances = [];
	this._boundaries = [];

	// the currently interactive parameters
	this._inkPoints = [];
	this._load = undefined;
	this._clearance = undefined;
	this._boundary = undefined;

	// input event handlers
	this._canvas.addEventListener('mousedown', this._mousedown.bind(this), false);
	this._canvas.addEventListener('mousemove', this._mousemove.bind(this), false);
	this._canvas.addEventListener('mouseup', this._mouseup.bind(this), false);
	document.addEventListener('keydown', this._keydown.bind(this), false);

	this._posDown = undefined;

	this._designElements = []; // visual elements that represent parameters
	this._funcElements = []; // visual elements specifically for functional requirements

	// drawing related visual elements
	this._ink = [];
	this._inkSize = 5;
	this._inkMat = XAC.MATERIALALT.clone();
	this._inkMat.opacity = 1;
}

// editing modes
FORTE.Design.POINTER = 0;
FORTE.Design.SKETCH = 1;
FORTE.Design.EDIT = 2;
FORTE.Design.LOADPOINT = 3.1;
FORTE.Design.LOADVECTOR = 3.2;
FORTE.Design.CLEARANCEAREA = 3.3;
FORTE.Design.CLEARANCEORIENTATION = 3.4;
FORTE.Design.BOUNDARYPOINT = 4;

FORTE.Design.prototype = {
	constructor: FORTE.Design
};

//
//
//	event handler for mouse down
//
//
FORTE.Design.prototype._mousedown = function(e) {
	if (e.which != XAC.LEFTMOUSE && (FORTE.USERIGHTKEYFOR3D == false ? (e.which != XAC.RIGHTMOUSE) :
			true)) {
		return;
	}

	var isEditing = FORTE.USERIGHTKEYFOR3D ? e.ctrlKey : (e.which == XAC.RIGHTMOUSE);
	if (isEditing == true && this._mode != FORTE.Design.EDIT) {
		this._modeSaved = this._mode;
		this._mode = FORTE.Design.EDIT;
		$(FORTE.canvasRenderer.domElement).css('cursor', 'pointer');
	} else if (isEditing == false && this._mode == FORTE.Design.EDIT) {
		this._mode = this._modeSaved;
		$(FORTE.canvasRenderer.domElement).css('cursor', this._mode == FORTE.Design.SKETCH ? 'crosshair' :
			'context-menu');
	}

	var hitInfo = XAC.hit(e, this._designElements, this._camera, this._canvas);

	this._maniPlane = new XAC.Maniplane(new THREE.Vector3(), this._scene, this._camera, this._canvas,
		false, false);

	this._posDown = {
		x: e.clientX,
		y: e.clientY
	};

	switch (this._mode) {
		case FORTE.Design.SKETCH:
			if (hitInfo != undefined) {
				this._maniPlane.setPosition(hitInfo.object.position);
				this._dropInk(hitInfo.point);
				log(this._inkSize)
			}
			break;

		case FORTE.Design.EDIT:
			// restoring previously selected items
			if (this._selected != undefined) {
				for (var i = this._selected.length - 1; i >= 0; i--) {
					this._selected[i].material.opacity = this._opacityFull;
					this._selected[i].material.needsUpdate = true;
				}
			}

			var selected = [];

			// attempt to select amongst functional elements
			if (FORTE.layer == FORTE.FUNCSPECLAYER) {
				funcElm = XAC.hitObject(e, this._funcElements, this._camera, this._canvas);
				if (funcElm != undefined && funcElm.parent != undefined) {
					// get to the `leaf' elements
					selected = funcElm.parent instanceof THREE.Scene ? [funcElm] : funcElm.parent
						.children;
				}
				this._funcElm = funcElm;
			}

			// selection temp - will cancel later if func elm is manipulated, not selected
			this._selectedTemp = selected;

			// select design only if no func. elms. selected
			if (this._funcElm == undefined) {
				this._medialAxis._mousedown(e);
			}

			for (var i = 0; i < this._boundaries.length; i++) {
				var edge = this._boundaries[i].edge;
				// redraw the boundary, diff from other design
				for (var j = edge.visuals.length - 1; j >= 0; j--) {
					edge.visuals[j].m.material = this._matBoundary;
					if(this.SHOWJOINTS) edge.joints[j < 1 ? 0 : j - 1].m.material = this._matBoundary;
				}
			}

			// record hit point for manipulation
			this._hitPointPrev = this._maniPlane.update(e);
			break;

		case FORTE.Design.LOADPOINT:
			if (hitInfo != undefined) {
				// use the selected point to initialize the load object
				this._maniPlane.setPosition(hitInfo.object.position);
				this._load = {
					points: [hitInfo.point],
					midPoint: hitInfo.point,
					vector: undefined,
					edge: this._medialAxis.getEdgeInfo(hitInfo.object), // associated edge
					area: [], // visual elements showing area of load
					areaIndices: [], // location info of loading area
					arrow: undefined // visual element showing vector of load
				}
			} else {
				this._mode = FORTE.Design.BOUNDARYPOINT;
				this._boundary = {
					points: [],
					edge: undefined
				};
			}
			break;

		case FORTE.Design.LOADVECTOR:
			// finalize the creation of a load and init the clearance object immediately
			if (this._load != undefined) {
				this._loads.push(this._load);
				this._funcElements = this._funcElements.concat(this._load.arrow.children);
				this._maniPlane.setPosition(this._load.midPoint);
				this._clearance = {
					box: undefined,
					midPoint: this._load.midPoint,
					edge: this._load.edge // associated edge
				}
			}
			break;

		case FORTE.Design.CLEARANCEAREA:
			// finalize the selection of a clearance area
			this._clearances.push(this._clearance);
			this._funcElements.push(this._clearance.box);
			break;

		case FORTE.Design.CLEARANCEORIENTATION:
			break;

		case FORTE.Design.BOUNDARYPOINT:
			// init the boundary object
			if (hitInfo != undefined) {
				this._maniPlane.setPosition(hitInfo.object.position);
			}
			this._boundary = {
				points: [],
				edge: undefined
			};
			break;
	}

	this._posMove = this._posDown;
}

//
//
//	event handler of mouse move
//
//
FORTE.Design.prototype._mousemove = function(e) {
	if (FORTE.USERIGHTKEYFOR3D == true && e.which == XAC.RIGHTMOUSE) {
		return;
	}

	if (e.which != XAC.LEFTMOUSE && e.which != XAC.RIGHTMOUSE && this._glueState != true) {
		return;
	}

	var isEditing = FORTE.USERIGHTKEYFOR3D ? e.ctrlKey : (e.which == XAC.RIGHTMOUSE);
	if (isEditing == true && this._mode != FORTE.Design.EDIT) {
		this._modeSaved = this._mode;
		this._mode = FORTE.Design.EDIT;
		$(FORTE.canvasRenderer.domElement).css('cursor', 'pointer');
	} else if (isEditing == false && this._mode == FORTE.Design.EDIT) {
		this._mode = this._modeSaved;
		$(FORTE.canvasRenderer.domElement).css('cursor', this._mode == FORTE.Design.SKETCH ? 'crosshair' :
			'context-menu');
	}

	var hitPoint;
	if (this._maniPlane != undefined) {
		hitPoint = this._maniPlane.update(e);
	}

	switch (this._mode) {
		case FORTE.Design.SKETCH:
			// BUG: hard code to fix for now
			if (hitPoint == undefined || hitPoint.x == 0 && hitPoint.y == 0 && hitPoint
				.z == 500) {} else {
				this._dropInk(hitPoint);
			}
			break;

		case FORTE.Design.EDIT:
			// either manipulating a func. elm or the design
			if (this._funcElm != undefined) {
				if (hitPoint != undefined && this._hitPointPrev != undefined) {
					this._funcElm = this._manipulate(this._funcElm, hitPoint, this._hitPointPrev);
					this._selectedTemp = [];
				}
			} else if (this._medialAxis._mousemove(e) != undefined) {
				this._updateConstraints(); // update functional specification constrained by some edges
			}
			break;

		case FORTE.Design.LOADPOINT:
			// dragging to select load points
			var hitElm = XAC.hitObject(e, this._designElements, this._camera, this._canvas);
			if (hitElm != undefined) {
				if (this._load.points.length > 0 && hitElm.position.distanceTo(this._load.points
						.slice(-1)[0]) > 0) {
					this._load.points.push(hitElm.position);
					this._load.area.push(hitElm);
					hitElm.material = this._matLoad;
				}
			}
			break;

		case FORTE.Design.LOADVECTOR:
			// show an arrow indicating the direction and magnititude of load
			this._scene.remove(this._load.arrow);
			this._load.vector = hitPoint.clone().sub(this._load.midPoint);
			this._load.vedge = new THREE.Vector3().subVectors(this._load.edge.points.slice(-
					1)[0],
				this._load.edge.points[0]);
			this._load.arrow = XAC.addAnArrow(this._scene, this._load.midPoint,
				this._load.vector, this._load.vector.length(), 3, this._matLoad);
			break;

		case FORTE.Design.CLEARANCEAREA:
			// moving the mouse to specify the area of clearance
			this._scene.remove(this._clearance.box);

			// compute the dimension of the clearance area
			this._clearance.vector = this._load.vector.clone().multiplyScalar(-1).normalize();
			var vclear = hitPoint.clone().sub(this._clearance.midPoint);
			this._clearance.hclear = vclear.dot(this._clearance.vector);
			this._clearance.wclear = Math.sqrt(Math.pow(vclear.length(), 2) - Math.pow(
				this._clearance.hclear, 2)) * 2;

			// create a mesh representation clearance
			this._clearance.box = new XAC.Box(this._clearance.wclear, this._clearance.hclear,
				5, this._matClearance).m;
			XAC.rotateObjTo(this._clearance.box, this._clearance.vector);
			this._clearance.box.position.copy(this._load.midPoint.clone()
				.add(this._clearance.vector.clone().multiplyScalar(0.5 * this._clearance.hclear))
			);

			this._clearance.vedge = new THREE.Vector3().subVectors(this._clearance.edge
				.points.slice(-1)[0],
				this._clearance.edge.points[0]);

			this._scene.add(this._clearance.box);
			break;

		case FORTE.Design.CLEARANCEORIENTATION:
			// move the mouse the rotate the clearance area
			if (this._hitPointPrev != undefined) {
				var vnow = hitPoint.clone().sub(this._clearance.midPoint);
				var vprev = this._hitPointPrev.clone().sub(this._clearance.midPoint);
				var angle = vprev.angleTo(vnow);
				var axis = vprev.clone().cross(vnow).normalize();
				this._clearance.vector.applyAxisAngle(axis, angle);

				this._scene.remove(this._clearance.box);
				this._clearance.box = new XAC.Box(this._clearance.wclear, this._clearance.hclear,
					5, this._matClearance).m;
				XAC.rotateObjTo(this._clearance.box, this._clearance.vector);
				this._clearance.box.position.copy(this._load.midPoint.clone()
					.add(this._clearance.vector.clone().multiplyScalar(0.5 * this._clearance
						.hclear)));

				this._scene.add(this._clearance.box);
			}
			break;

		case FORTE.Design.BOUNDARYPOINT:
			// BUG: hard code to fix for now
			if (hitPoint == undefined || hitPoint.x == 0 && hitPoint.y == 0 && hitPoint
				.z == 500) {} else {
				this._dropInk(hitPoint);
			}
			break;
	}

	this._posMove = {
		x: e.clientX,
		y: e.clientY
	};
	this._hitPointPrev = hitPoint;
}

//
//
//	event handler of mouse up
//
//
FORTE.Design.prototype._mouseup = function(e) {
	if (e.which != XAC.LEFTMOUSE && FORTE.USERIGHTKEYFOR3D == true) {
		return;
	}

	if (this._maniPlane != undefined) {
		this._maniPlane.destruct();
	}

	switch (this._mode) {
		case FORTE.Design.POINTER:
			break;

		case FORTE.Design.SKETCH:
			if (this._ink.length <= 0) break;

			var mergedPoints = this._postProcessInk();

			// add to the medial axis with auto-added nodes
			var anglePrev;

			// TODO: don't split for now
			var autoSplit = false;
			var autoJoin = false;

			// i starting at 2 to avoid corner cases at the starting point
			for (var i = 2; i < mergedPoints.length - 2; i++) {
				if (i - 1 < 0 || i + 1 >= mergedPoints.length) {
					continue;
				}

				var v1 = mergedPoints[i + 1].clone().sub(mergedPoints[i]);
				var v0 = mergedPoints[i].clone().sub(mergedPoints[i - 1]);
				var angle = v1.angleTo(v0);

				if (anglePrev != undefined) {
					if (Math.abs(angle - anglePrev) > Math.PI / 4) {
						this._medialAxis.addEdge(mergedPoints.slice(0, i + 1), autoSplit, autoJoin);

						mergedPoints = mergedPoints.slice(i);
						i = 0;
						anglePrev = undefined;
						continue;
					}
				}
				anglePrev = angle;
			}
			this._medialAxis.addEdge(mergedPoints, autoSplit);

			this._inkPoints = [];
			break;

		case FORTE.Design.EDIT:
			// highlight selection or wrap up design manipulation
			if (this._selectedTemp.length > 0) {
				for (var i = this._selectedTemp.length - 1; i >= 0; i--) {
					if (this._selected != undefined && this._selectedTemp[i] == this._selected[
							i]) {
						this._selectedTemp = [];
						break;
					}
					this._selectedTemp[i].material.opacity = this._opacityHalf;
					// this._selectedTemp[i].material.needsUpdate = true;

				}
				this._selected = this._selectedTemp;
			} else {
				this._medialAxis._mouseup(e);
				this._updateConstraints();
			}

			// redraw boundary to make it diff from other design elms
			for (var i = 0; i < this._boundaries.length; i++) {
				var edge = this._boundaries[i].edge;
				edge.node1.visual.m.material = this._matBoundary;
				edge.node2.visual.m.material = this._matBoundary;
			}

			// editing is a one-time thing
			this._mode = this._modeSaved;
			$(FORTE.canvasRenderer.domElement).css('cursor', this._mode == FORTE.Design.SKETCH ? 'crosshair' :
				'context-menu');

			break;

		case FORTE.Design.LOADPOINT:
			if (this._load == undefined || this._load.points.length <= 0) break;

			// find the mid point of loading given a series of selected points
			if (this._load.points.length <= 2) {
				this._load.midPoint = this._load.points[0];
			} else {
				var start = this._load.points[0];
				var end = this._load.points.slice(-1)[0];
				var distVarMin = start.distanceTo(end);
				for (var i = this._load.points.length - 2; i >= 1; i--) {
					var distVar = Math.abs(this._load.points[i].distanceTo(start) - this._load
						.points[i].distanceTo(end));
					if (distVar < distVarMin) {
						distVarMin = distVar;
						this._load.midPoint = this._load.points[i];
					}
				}

				for (var i = 0; i < this._load.edge.visuals.length; i++) {
					var visual = this._load.edge.visuals[i].m;
					for (var j = 0; j < this._load.area.length; j++) {
						var loadArea = this._load.area[j];
						if (visual == loadArea) {
							this._load.areaIndices.push(i);
							break;
						}
					}
				}
			}
			this._mode = FORTE.Design.LOADVECTOR;
			this._glueState = true;
			break;

		case FORTE.Design.LOADVECTOR:
			this._mode = FORTE.Design.CLEARANCEAREA;
			break;

		case FORTE.Design.CLEARANCEAREA:
			this._mode = FORTE.Design.CLEARANCEORIENTATION;
			break;

		case FORTE.Design.CLEARANCEORIENTATION:
			this._mode = FORTE.Design.LOADPOINT;
			this._load = undefined;
			this._clearance = undefined;
			this._glueState = false;
			break;

		case FORTE.Design.BOUNDARYPOINT:
			this._mode = FORTE.Design.LOADPOINT;

			if (this._ink.length <= 0) break;
			// remove ink and clean up
			var mergedPoints = this._postProcessInk();
			this._boundary.points = mergedPoints;

			// convert it to topology and store the visual elements
			var edge = this._medialAxis.addEdge(mergedPoints);
			this._boundary.edge = edge;

			// redraw the boundary
			for (var i = edge.visuals.length - 1; i >= 0; i--) {
				edge.visuals[i].m.material = this._matBoundary;
				if(this.SHOWJOINTS)  edge.joints[i < 1 ? 0 : i - 1].m.material = this._matBoundary;
				this._funcElements.push(edge.visuals[i].m);
			}

			edge.node1.visual.m.material = this._matBoundary;
			this._funcElements.push(edge.node1.visual.m);

			edge.node2.visual.m.material = this._matBoundary;
			this._funcElements.push(edge.node2.visual.m);

			this._inkPoints = [];

			this._boundaries.push(this._boundary);

			break;
	}

	// TODO: highly experimental
	// updating the storage of all functional and design elements
	this._funcElements = [];
	for (var i = this._loads.length - 1; i >= 0; i--) {
		this._funcElements = this._funcElements.concat(this._loads[i].arrow.children);
		// this._funcElements = this._funcElements.concat(this._loads[i].area);
	}
	for (var i = this._clearances.length - 1; i >= 0; i--) {
		this._funcElements.push(this._clearances[i].box);
	}

	this._designElements = [];
	for (var i = this._medialAxis.edges.length - 1; i >= 0; i--) {
		var edge = this._medialAxis.edges[i];
		this._designElements.push(edge.node1.visual.m);
		this._designElements.push(edge.node2.visual.m);
		for (var j = edge.visuals.length - 1; j >= 0; j--) {
			this._designElements.push(edge.visuals[j].m);
		}
	}
}

//
//	event handler of keyboard operation
//
FORTE.Design.prototype._keydown = function(e) {
	if (e.keyCode == 27) { // ESC
		switch (this._mode) {
			case FORTE.Design.SKETCH:
				break;

			case FORTE.Design.LOADPOINT:
				break;

			case FORTE.Design.LOADVECTOR:
				// cancel the current operation and forfeit the creation of the load
				this._removeLoad(this._load);
				this._glueState = false;
				this._mode = FORTE.Design.LOADPOINT;
				this._load = undefined;
				break;

			case FORTE.Design.CLEARANCEAREA:
				this._removeClearance(this._clearance);
				// merging these two cases here
			case FORTE.Design.CLEARANCEORIENTATION:
				this._glueState = false;
				this._mode = FORTE.Design.LOADPOINT;
				this._load = undefined;
				this._clearance = undefined;
				break;

			case FORTE.Design.BOUNDARYPOINT:
				break;

			case FORTE.Design.BOUNDARYAREA:
				break;
		}
	} else if (e.keyCode == 46) { // DEL
		for (var i = this._loads.length - 1; i >= 0; i--) {
			if (this._loads[i].arrow.children.indexOf(this._funcElm) >= 0) {
				this._removeLoad(this._loads[i]);
				return;
			}
		}

		for (var i = this._clearances.length - 1; i >= 0; i--) {
			if (this._clearances[i].box == this._funcElm) {
				this._removeClearance(this._clearances[i]);
				return;
			}
		}

		// if an edge is deleted, remove its functional requirments
		var edge = this._medialAxis._keydown(e);
		if (edge != undefined && edge.type == FORTE.MedialAxis.EDGE) {
			// find corresponding load
			for (var i = 0; i < this._loads.length; i++) {
				if (this._loads[i].edge == edge) {
					this._removeLoad(this._loads[i]);
				}
			}

			// find corresponding clerance
			for (var i = 0; i < this._clearances.length; i++) {
				if (this._clearances[i].edge == edge) {
					this._removeClearance(this._clearances[i]);
				}
			}
		}

	}
}


//
// adjust sketching stroke thickness
// 0<=t<=1, 0 is the thinnest, t is the thickest
//
FORTE.Design.prototype.setInkSize = function(t) {
	this._minInkSize = 2.5;
	this._maxInkSize = 10;
	this._inkSize = this._minInkSize + t * (this._maxInkSize - this._minInkSize);
	this._inkSize = XAC.clamp(this._inkSize, this._minInkSize, this._maxInkSize);
	this._medialAxis._radiusEdge = this._inkSize / 2;
	this._medialAxis._radiusNode = this._medialAxis._radiusEdge * 1.1;
}

//
//	subroutine for drawing (not standalone)
//
FORTE.Design.prototype._dropInk = function(inkPoint, mat) {
	var inkJoint = new XAC.Sphere(this._inkSize / 2, this._inkMat).m;
	inkJoint.position.copy(inkPoint);

	this._inkPoints.push(inkPoint);

	this._scene.add(inkJoint);
	if (this._ink.length > 0) {
		var inkStroke = new XAC.ThickLine(this._inkPointPrev, inkPoint,
			this._inkSize / 2, mat == undefined ? this._inkMat : mat).m;
		this._scene.add(inkStroke);
	}

	this._ink.push(inkJoint);
	this._ink.push(inkStroke);

	this._inkPointPrev = inkPoint;
}

//
//	subroutine for updating constraints between visual elements (and the info they represent)
//
FORTE.Design.prototype._updateConstraints = function() {
	//	loads
	for (var i = this._loads.length - 1; i >= 0; i--) {
		var load = this._loads[i];
		var edge = load.edge;
		var vedge = new THREE.Vector3().subVectors(edge.points.slice(-1)[0],
			edge.points[0]);

		var axis = new THREE.Vector3().crossVectors(load.vedge, vedge).normalize();
		var angle = load.vedge.angleTo(vedge);
		load.vector.applyAxisAngle(axis, angle);
		load.vedge = vedge;

		this._scene.remove(load.arrow);
		load.arrow = XAC.addAnArrow(this._scene, load.midPoint, load.vector, load.vector
			.length(), 3, this._matLoad);

		for (var j = 0; j < load.areaIndices.length; j++) {
			var idx = load.areaIndices[j];
			load.edge.visuals[idx].m.material = this._matLoad;
		}
	}

	//	clearances
	for (var i = this._clearances.length - 1; i >= 0; i--) {
		var clearance = this._clearances[i];
		var edge = clearance.edge;
		var vedge = new THREE.Vector3().subVectors(edge.points.slice(-1)[0],
			edge.points[0]);

		var axis = new THREE.Vector3().crossVectors(clearance.vedge, vedge).normalize();
		var angle = clearance.vedge.angleTo(vedge);
		clearance.vector.applyAxisAngle(axis, angle);

		var scaled = vedge.length() / clearance.vedge.length();
		clearance.wclear *= scaled;

		clearance.vedge = vedge;

		this._scene.remove(clearance.box);
		clearance.box = new XAC.Box(clearance.wclear, clearance.hclear,
			5, this._matClearance).m;
		XAC.rotateObjTo(clearance.box, clearance.vector);
		clearance.box.position.copy(clearance.midPoint.clone()
			.add(clearance.vector.clone().multiplyScalar(0.5 * clearance.hclear)));
		this._scene.add(clearance.box);
	}
}

//
//	manipulate an element based on dragging
//	@param	elm - the element to be manipulated
//	@param	ptnow - the current manipulating point
//	@param	ptprev - the previous manipulating point
//
FORTE.Design.prototype._manipulate = function(elm, ptnow, ptprev) {
	var vdelta = ptnow.clone().sub(ptprev);
	if (vdelta == undefined) {
		return;
	}

	for (var i = this._loads.length - 1; i >= 0; i--) {
		var load = this._loads[i];
		var idx = load.arrow.children.indexOf(elm);
		if (idx >= 0) {
			load.vector.add(vdelta);
			this._scene.remove(load.arrow);
			load.arrow = XAC.addAnArrow(this._scene, load.midPoint, load.vector, load.vector
				.length(), 3, this._matLoad);
			return load.arrow.children[idx];
		}
	}

	for (var i = this._clearances.length - 1; i >= 0; i--) {
		if (this._clearances[i].box == elm) {
			var clearance = this._clearances[i];

			// compute `vertical' scaling
			var vnormal = clearance.vector.clone().normalize();
			var dh = vdelta.dot(vnormal);
			clearance.hclear += dh;

			// compute `horizontal' scaling
			var vnow = ptnow.clone().sub(clearance.midPoint);
			dnow = Math.sqrt(Math.pow(vnow.length(), 2) - Math.pow(vnow.dot(vnormal), 2));
			var vprev = ptprev.clone().sub(clearance.midPoint);
			dprev = Math.sqrt(Math.pow(vprev.length(), 2) - Math.pow(vprev.dot(vnormal),
				2));
			clearance.wclear *= 1 + (dnow / dprev - 1) * (dnow / clearance.wclear / 2);

			// redraw the box
			this._scene.remove(clearance.box);
			clearance.box = new XAC.Box(clearance.wclear, clearance.hclear,
				5, this._matClearance).m;
			XAC.rotateObjTo(clearance.box, clearance.vector);
			clearance.box.position.copy(clearance.midPoint.clone()
				.add(clearance.vector.clone().multiplyScalar(0.5 * clearance.hclear)));
			this._scene.add(clearance.box);
			return clearance.box;
		}
	}
}

//
//	remove a load
//
FORTE.Design.prototype._removeLoad = function(load) {
	for (var i = load.area.length - 1; i >= 0; i--) {
		load.area[i].material = this._matDesign;
		load.area[i].material.needsUpdate = true;
	}
	this._scene.remove(load.arrow);
	for (var i = load.arrow.children.length - 1; i >= 0; i--) {
		XAC.removeFromArray(this._funcElements, load.arrow.children[i]);
	}
	XAC.removeFromArray(this._loads, load);
}

//
//	remove a clearance
//
FORTE.Design.prototype._removeClearance = function(clearance) {
	this._scene.remove(clearance.box);
	XAC.removeFromArray(this._funcElements, clearance.box);
	XAC.removeFromArray(this._clearances, clearance);
}

//
//	extend medial axis to retrieve edge info from its representatin (mesh)
//
FORTE.MedialAxis.prototype.getEdgeInfo = function(mesh) {
	for (var i = this.edges.length - 1; i >= 0; i--) {
		if (this.edges[i].node1.visual.m == mesh || this.edges[i].node2.visual.m == mesh) {
			return this.edges[i];
		}
		for (var j = this.edges[i].visuals.length - 1; j >= 0; j--) {
			if (this.edges[i].visuals[j].m == mesh) {
				return this.edges[i];
			}
		}
	}
}

//
//	subroutine for post processing drawn ink points
//
FORTE.Design.prototype._postProcessInk = function() {
	// remove temp ink, compute their circumference
	var lenTotal = 0;
	for (var i = this._inkPoints.length - 1; i >= 0; i--) {
		this._scene.remove(this._ink[2 * i]);
		this._scene.remove(this._ink[2 * i + 1]);
		if (i > 0)
			lenTotal += this._inkPoints[i].distanceTo(this._inkPoints[i - 1]);
	}
	this._ink = [];

	// merge points that are too close to each other
	var mergedPoints = [];
	var minSpacing = Math.min(lenTotal / 50, 5);

	mergedPoints.push(this._inkPoints[0]);
	for (var i = 1; i < this._inkPoints.length - 2; i++) {
		var mergedPoint = this._inkPoints[i].clone();
		while (i < this._inkPoints.length - 2 && this._inkPoints[i + 1].distanceTo(
				mergedPoint) < minSpacing) {
			v1 = this._inkPoints[i].clone().sub(this._inkPoints[i + 1]);
			v2 = this._inkPoints[i + 2].clone().sub(this._inkPoints[i + 1]);
			i++;
			if (v1.angleTo(v2) < Math.PI) {
				continue;
			}
			mergedPoint.add(this._inkPoints[i]).multiplyScalar(0.5);
		}
		mergedPoints.push(mergedPoint);
	}
	mergedPoints.push(this._inkPoints.slice(-1)[0]);

	// log(minSpacing + ', ' + mergedPoints.length)

	return mergedPoints;
}

//
//	get the data of the design, including func. req.
//
FORTE.Design.prototype.getData = function() {
	var forte = {}

	// the boundaries
	var boundaryEdges = [];
	if (this._boundariesRaw == undefined) {
		forte.boundaries = [];
		for (var i = 0; i < this._boundaries.length; i++) {
			var points = [];
			for (var j = 0; j < this._boundaries[i].points.length; j++) {
				points.push(this._boundaries[i].points[j].toArray().trim(2));
			}
			forte.boundaries.push(points);
			boundaryEdges.push(this._boundaries[i].edge);
		}
	} else {
		forte.boundaries = this._boundariesRaw;
	}

	// the design
	if (this._designRaw == undefined) {
		forte.design = [];
		for (var i = 0; i < this._medialAxis.edges.length; i++) {
			var edge = this._medialAxis.edges[i];
			if (boundaryEdges.indexOf(edge) >= 0 || edge.deleted == true) continue;
			// TODO: do not pack nodes
			forte.design.push(this._medialAxis.pack(edge, true));
		}
	} else {
		forte.design = this._designRaw;
	}

	// the loads
	if (this._loadsRaw == undefined) {
		forte.loads = [];
		var sumLoads = 0;
		for (var i = 0; i < this._loads.length; i++) {
			sumLoads += this._loads[i].vector.length();
		}

		for (var i = 0; i < this._loads.length; i++) {
			var load = {};
			load.points = [];
			for (var j = 0; j < this._loads[i].points.length; j++) {
				load.points.push(this._loads[i].points[j].toArray().trim(2));
			}
			load.vectors = this._distriute(load.points, this._loads[i].vector,
				this._loads[i].midPoint, sumLoads);
			forte.loads.push(load);
		}
	} else {
		forte.loads = this._loadsRaw;
	}

	// the clearances
	if (this._clearancesRaw == undefined) {
		forte.clearances = [];
		for (var i = 0; i < this._clearances.length; i++) {
			var clearance = [];
			var vertices = this._clearances[i].box.geometry.vertices;
			for (var j = 0; j < vertices.length; j++) {
				var vtransformed = XAC.getTransformedVector(vertices[j], this._clearances[i]
					.box);
				clearance.push(vtransformed.toArray().trim(2));
			}
			forte.clearances.push(clearance);
		}
	} else {
		forte.clearances = this._clearancesRaw;
	}

	return JSON.stringify(forte);
}

//
//	subroutine for distributing a load vector across load points
//
FORTE.Design.prototype._distriute = function(points, vector, midPoint,
	normalizeFactor) {
	var distrVectors = [];

	// fit the load points on an arc
	var circleInfo = XAC.fitCircle(points);
	var ctr = new THREE.Vector3(circleInfo.x0, circleInfo.y0, circleInfo.z0);

	// distribute the loads cocentrically
	var umid = midPoint.clone().sub(ctr);
	var len = vector.length() / points.length;
	for (var i = 0; i < points.length; i++) {
		var point = new THREE.Vector3().fromArray(points[i]);
		var u = point.clone().sub(ctr);
		var angle = umid.angleTo(u);
		var axis = umid.clone().cross(u).normalize();

		distrVectors.push(vector.clone().applyAxisAngle(axis, angle).divideScalar(
			points.length).divideScalar(normalizeFactor).toArray().trim(2));

		// DEBUG: to show the load direction at each point
		// XAC.addAnArrow(this._scene, point, v, len, 2, this._matLoad);
		// log([point, v, len])
	}

	return distrVectors;
}

FORTE.Design.prototype.getDesignElements = function() {
	return this._designElements;
}

//
//	pack the elements (edges and/or nodes) into JSONable format
//
FORTE.MedialAxis.prototype.pack = function(elm, addNodes) {
	if (elm.type == FORTE.MedialAxis.EDGE) {
		var edge = {};
		edge.node1 = elm.node1.position.toArray().trim(2);
		edge.node2 = elm.node2.position.toArray().trim(2);

		edge.points = []
		if (addNodes) edge.points.push(edge.node1);
		for (var i = 0; i < elm.points.length; i++) {
			edge.points.push(elm.points[i].toArray().trim(2));
		}
		if (addNodes) edge.points.push(edge.node2);

		edge.thickness = XAC.copyArray(elm.thickness);
		if (addNodes) {
			edge.thickness.push(elm.node2.radius);
			edge.thickness = [elm.node1.radius].concat(edge.thickness);
		}

		// TODO: impose a min thickness
		var minThickness = 2;
		for (var i = 0; i < edge.thickness.length; i++) {
			edge.thickness[i] = Math.max(edge.thickness[i], minThickness);
		}

		return edge;
	}
}

//
//	trim each number in the array to a given precision
//
Array.prototype.trim = function(numDigits) {
	for (i = 0; i < this.length; i++) {
		this[i] = Number(this[i].toFixed(numDigits));
	}
	return this;
}

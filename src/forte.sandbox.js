function unitTest() {
	log('---------------- unit test begins ----------------');

	// DEBUG: distance fields
	FORTE.t = 0;
	var intval = 0.05;
	var step = 0.05;

	document.addEventListener('keydown', function(e) {
		switch (e.keyCode) {
			case 48:
				FORTE.design._mode = FORTE.Design.POINTER;
				$(FORTE.canvasRenderer.domElement).css('cursor', 'pointer');
				break;
			case 49:
				FORTE.switchLayer(FORTE.FORMLAYER);
				break;
			case 50:
				FORTE.switchLayer(FORTE.FUNCSPECLAYER);
				break;
			case 56: // 8
				var forte = FORTE.design.getData();
				forte = FORTE.expandSketch(forte, 1);
				var strData = JSON.stringify(forte);
				log(strData)
				break;
			case 57: // 9
				var forte = FORTE.design.getData();
				forte = FORTE.ignoreSketch(forte, 1);
				var strData = JSON.stringify(forte);
				log(strData)
				break;
			case 83: // S
				var strData = JSON.stringify(FORTE.design.getData());
				log(strData)
					// XAC.pingServer(FORTE.xmlhttp, 'localhost', '9999', ['forte', 'query',
					// 	'resolution', 'material', 'originality', 'verbose'
					// ], [strData, 0, 64, 0.25, 1.0, 1]);
					// keepPinging(6000);
					// FORTE.switchLayer(FORTE.FEEDBACKLAYER);
				break;
			case 79: //O
				var strData = FORTE.design.getData();
				XAC.pingServer(FORTE.xmlhttp, 'localhost', '9898', ['forte', 'query',
					'resolution', 'material', 'gradient'
				], [strData, 1, 64, 1, 0.1]);
				log(strData)
				break;
			case 68: //D
				FORTE.mixedInitiative = FORTE.mixedInitiative == null ? new FORTE.MixedInitiatives(FORTE.canvasScene) :
					FORTE.mixedInitiative;
				dfs.push(FORTE.mixedInitiative._computeDistanceField(FORTE.design));
				intval = 2 - dfs.length;
				break;
			case 37: // left arrow
				FORTE.t = XAC.clamp(FORTE.t - step, 0, 1);
				FORTE.design.setGradient(FORTE.t);
				break;
			case 39: // right arrow
				FORTE.t = XAC.clamp(FORTE.t + step, 0, 1);
				FORTE.design.setGradient(FORTE.t);
				break;
			case 67: // C
				// FORTE.voxelGrid.clear();
				var strData = FORTE.design.getData();
				log(strData)
				break;
			case 80:
				FORTE.paused = (FORTE.paused != true);
				if (FORTE.paused == false) {
					FORTE.render();
				}
				break;
		}
	}, false);

	log('----------------  unit test ends  ----------------');
}

FORTE.Design.cleanup = function(design) {
	var edges = design.design;
	for (var i = 0; i < edges.length; i++) {
		if (edges[i].points.length <= 2) {
			edges[i].points = [edges[i].node1].concat(edges[i].points);
			edges[i].points.push(edges[i].node2);
			edges[i].thickness = [edges[i].thickness[0]].concat(edges[i].thickness);
			edges[i].thickness.push(edges[i].thickness[0]);
		}

		var minThickness = 1;
		for (var j = 0; j < edges[i].thickness.length; j++) {
			edges[i].thickness[j] = Math.max(minThickness, edges[i].thickness[j]);
		}
	}
}

FORTE.Design.prototype.interpolate = function(designs, weights) {
	for (var i = 0; i < this._medialAxis.edges.length; i++) {
		var edge = this._medialAxis.edges[i];

		// interpolating the nodes
		var nodes = [edge.node1, edge.node2];
		for (var j = 0; j < nodes.length; j++) {
			var centroid = new THREE.Vector3();
			for (var k = 0; k < designs.length; k++) {
				var nodePosArray = j == 0 ? designs[k].design[i].node1 : designs[k].design[i].node2;
				var nodePos = new THREE.Vector3().fromArray(nodePosArray);
				centroid.add(nodePos.multiplyScalar(weights[k]));
			}
			nodes[j].position.copy(centroid);
		}

		// interpolating the points on the edge
		for (var j = 0; j < edge.points.length; j++) {
			var centroid = new THREE.Vector3();
			for (var k = 0; k < designs.length; k++) {
				var pointArray = designs[k].design[i].points[j];
				var point = new THREE.Vector3().fromArray(pointArray);
				centroid.add(point.multiplyScalar(weights[k]));
			}
			edge.points[j].copy(centroid);
		}
	}
	this._medialAxis._render();
}

FORTE.Design.fromRawData = function(designObj, canvas, scene, camera) {
	try {
		log(designObj)

		// design
		var design = new FORTE.Design(scene, camera);
		design._medialAxis = FORTE.MedialAxis.fromRawData(designObj.design, canvas, scene, camera);
		// design._medialAxis._matNode = design._matDesign;
		// design._medialAxis._matvisual = design._matDesign;
		// design._medialAxis._matHighlight.opacity = 1;
		design._inkSize = 2 * design._medialAxis._radiusEdge;

		// update design elements
		design._designElements = [];
		for (var i = design._medialAxis.edges.length - 1; i >= 0; i--) {
			var edge = design._medialAxis.edges[i];
			design._designElements.push(edge.node1.visual.m);
			design._designElements.push(edge.node2.visual.m);
			for (var j = edge.visuals.length - 1; j >= 0; j--) {
				design._designElements.push(edge.visuals[j].m);
			}
		}

		// store raw data
		design._loadsRaw = designObj.loads;
		design._boundariesRaw = designObj.boundaries;
		design._clearancesRaw = designObj.clearances;

		// HACK
		FORTE.designOriginal = [];
		FORTE.designNew = [];
		for (var i = 0; i < designObj.design.length; i++) {
			if (designObj.isNew != undefined && designObj.isNew[i] == true) {
				FORTE.designNew.push(designObj.design[i]);
			} else {
				FORTE.designOriginal.push(designObj.design[i]);
			}
		}

		if (FORTE.designNew.length > 0) {
			FORTE.interpolation = FORTE.interpolation || new FORTE.Interpolation(FORTE.designOriginal, FORTE.designNew,
				FORTE.canvasScene, FORTE.canvasCamera);
		}

		return design;
	} catch (e) {
		err(e.stack);
	}
}

FORTE.MedialAxis.prototype.refreshFromRawData = function(edges, nodes) {
	// for (var i = 0; i < this._visuals.length; i++) {
	// 	this._scene.remove(this._visuals[i]);
	// }

	if (edges != undefined) {
		this._edges = [];
		for (var i = 0; i < edges.length; i++) {
			var points = [];
			var node1Pos = new THREE.Vector3().fromArray(edges[i].node1);
			var node2Pos = new THREE.Vector3().fromArray(edges[i].node2);
			points.push(node1Pos);
			for (var j = 0; j < edges[i].points.length; j++) {
				points.push(new THREE.Vector3().fromArray(edges[i].points[j]));
			}
			points.push(node2Pos);
			this.addEdge(points, false, false);
		}
	}

	this._render();
}

//
//	for experiment, post-processing to expand a user's sketch until it meets the amount of material
//
FORTE.expandSketch = function(designObj, amnt) {
	for (var i = 0; i < designObj.design.length; i++) {
		var edge = designObj.design[i];
		for (var j = 0; j < edge.thickness.length; j++) {
			edge.thickness[j] *= amnt;
			edge.favVals[j] = 0.99;
		}
	}
	// designObj
	return designObj;
}

//
//	for experiment, ignoring a user's sketch completely
//
FORTE.ignoreSketch = function(designObj) {
	for (var i = 0; i < designObj.design.length; i++) {
		var edge = designObj.design[i];
		for (var j = 0; j < edge.thickness.length; j++) {
			edge.thickness[j] = XAC.EPSILON;
			edge.favVals[j] = XAC.EPSILON;
		}
	}
	// designObj
	return designObj;
}

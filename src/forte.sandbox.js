function unitTest() {
	log('---------------- unit test begins ----------------');

	// DEBUG: distance fields
	var dfs = [];
	var intval = 0.05;
	var step = 0.05;

	// HACK
	// var keepPinging = function(interval) {
	// 	var strData = FORTE.design.getData();
	// 	log('request sent for t = ' + FORTE.t)
	// 	XAC.pingServer(FORTE.xmlhttp, 'localhost', '9999', ['forte', 'query',
	// 		'resolution', 'material', 'originality', 'verbose'
	// 	], [strData, 0, 64, 0.25, 1.0, 1]);
	// 	FORTE.t -= step;
	// 	if (FORTE.t >= 0 && interval != undefined) {
	// 		FORTE.design._medialAxis.updateFromRawData(FORTE.designOriginal.clone().concat(FORTE.interpolation
	// 			.interpolate(FORTE.t)));
	// 		setTimeout(function() {
	// 			keepPinging(interval);
	// 		}, interval);
	// 	}
	// }

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
			case 83: //S
				var strData = FORTE.design.getData();
				log(strData)
					// XAC.pingServer(FORTE.xmlhttp, 'localhost', '9999', ['forte', 'query',
					// 	'resolution', 'material', 'originality', 'verbose'
					// ], [strData, 0, 64, 0.25, 1.0, 1]);
					// keepPinging(6000);
				FORTE.switchLayer(FORTE.FEEDBACKLAYER);
				break;
			case 79: //O
				var strData = FORTE.design.getData();
				XAC.pingServer(FORTE.xmlhttp, 'localhost', '9999', ['forte', 'query',
					'resolution', 'material', 'originality', 'verbose'
				], [strData, 1, 64, 0.3, 1.0, 1]);
				log(strData)
				break;
			case 68: //D
				FORTE.mixedInitiative = FORTE.mixedInitiative == null ? new FORTE.MixedInitiatives(FORTE.canvasScene) :
					FORTE.mixedInitiative;
				dfs.push(FORTE.mixedInitiative._computeDistanceField(FORTE.design));
				intval = 2 - dfs.length;
				break;
			case 37: // left arrow
				// idxt = XAC.clamp(idxt + 1, 0, dfmts.length - 1);
				// log(idxt)
				// mimt._showDistanceField(dfmts[idxt], new THREE.Vector3(0, 50, 0));
				// mili._interpolateDistanceFields(df1, df2, idxt * 1.0 / (dfmts.length - 1));
				// FORTE.tmp -= 0.1;
				// FORTE.design.setInkSize(FORTE.tmp);
				var t = XAC.clamp(FORTE.t - step, 0, 1);
				if (FORTE.t != t) {
					FORTE.t = t;
					// FORTE.design.interpolate(FORTE.designVariations, [FORTE.t, 1 - FORTE.t]);
					FORTE.design._medialAxis.updateFromRawData(FORTE.designOriginal.clone().concat(FORTE.interpolation
						.interpolate(FORTE.t)));
					log(FORTE.t)
				}
				// log(FORTE.canvasScene.children.length)
				break;
			case 39: // right arrow
				// idxt = XAC.clamp(idxt - 1, 0, dfmts.length - 1);
				// log(idxt)
				// mimt._showDistanceField(dfmts[idxt], new THREE.Vector3(0, 50, 0));
				// mili._interpolateDistanceFields(df1, df2, idxt * 1.0 / (dfmts.length - 1));
				// FORTE.tmp += 0.1;
				// FORTE.design.setInkSize(FORTE.tmp);
				var t = XAC.clamp(FORTE.t + step, 0, 1);
				if (FORTE.t != t) {
					FORTE.t = t;
					// FORTE.design.interpolate(FORTE.designVariations, [FORTE.t, 1 - FORTE.t]);
					FORTE.design._medialAxis.updateFromRawData(FORTE.designOriginal.clone().concat(FORTE.interpolation
						.interpolate(FORTE.t)));
					log(FORTE.t)
				}
				// log(FORTE.canvasScene.children.length)
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

	FORTE.tmp = 0.2;
	// FORTE.design.setInkSize(FORTE.tmp);

	FORTE.t = 1;

	// HACK testing disp vector and stress computing
	FORTE.voxelGrid = new FORTE.VoxelGrid(FORTE.canvasScene, new THREE.Vector3());
	var resultVoxelGrid = 'forte_1473363748_128_0.102_analyzed.vxg'
	var resultDisp = 'forte_1473363748_128_0.102_analyzed.disp'
	var dimVoxel = 1;
	XAC.readTextFile(resultVoxelGrid, function(dataVoxelGrid) {
		if (dataVoxelGrid == undefined) return;

		FORTE.voxelGrid.load(dataVoxelGrid, dimVoxel);
		FORTE.visualizer = FORTE.visualizer == undefined ? new FORTE.Visualizer(
			FORTE.canvasScene) : FORTE.visualizer;
		FORTE.visualizer.clear();
		XAC.readTextFile(resultDisp, function(dataDisp) {
			if (dataDisp != undefined) {
				// FORTE.visualizer.visualizeStress(dataDisp, FORTE.voxelGrid);
				FORTE.visualizer.visualizeStressInVivo(dataDisp, FORTE.voxelGrid,
					FORTE.design.getDesignElements());
			}
		});

	});


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

// FORTE.arrays2threes = function()

FORTE.updateDeltas = function(toRefresh) {
	// log('--')
	var design = FORTE.designSpace.design.clone();
	for (var i = 0; i < FORTE.deltas.length; i++) {
		design = design.concat(FORTE.deltas[i]._designNew);
	}

	// if (toRefresh) {
	// 	FORTE.design._medialAxis.refreshFromRawData(design);
	// } else {
	FORTE.design._medialAxis.updateFromRawData(design, toRefresh);
	// }

	// log('--')
}

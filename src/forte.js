/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	Main of the Forte project
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

$(document).ready(function() {
	// rendering ui
	$(document.body).append(FORTE.renderUI());

	//
	// visualize stats
	//
	FORTE.stats = new Stats();
	FORTE.stats.domElement.style.position = 'absolute';
	FORTE.stats.domElement.style.top = '0px';
	FORTE.stats.domElement.style.right = '0px';
	document.body.appendChild(FORTE.stats.domElement);

	//
	//	main canvas rendering
	//
	FORTE.render = function() {
		if (FORTE.paused) {
			return;
		}

		requestAnimationFrame(FORTE.render);
		FORTE.camCtrl.update();
		FORTE.stats.update();
		// FORTE.lights[0].position.copy(FORTE.canvasCamera.position);
		FORTE.canvasRenderer.render(FORTE.canvasScene, FORTE.canvasCamera);
	};

	FORTE.render();

	//
	// set up ui
	//
	FORTE.FORMLAYER = 0;
	FORTE.FUNCTIONLAYER = 1;
	FORTE.FUNCSPECLAYER = 1.1
	FORTE.FEEDBACKLAYER = 1.2;
	FORTE.SUGGESTIONLAYER = 1.3
	FORTE.FABRICATIONLAYER = 2;

	FORTE.USERIGHTKEYFOR3D = false;
	FORTE.camCtrl.noRotate = !FORTE.USERIGHTKEYFOR3D

	//
	//	set up communication
	//
	FORTE.QUERYANALYZE = 0;
	FORTE.QUERYOPTIMIZE = 1;
	FORTE.xmlhttp = new XMLHttpRequest();
	FORTE.xmlhttp.timeout = 1e9;
	FORTE.xmlhttp.onreadystatechange = function() {
		if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
			log(FORTE.xmlhttp.responseText);
			var name = XAC.getParameterByName('name', FORTE.xmlhttp.responseText);
			FORTE.thisQuery = XAC.getParameterByName('query', FORTE.xmlhttp.responseText);
			var dimVoxel = XAC.getParameterByName('dim_voxel', FORTE.xmlhttp.responseText);
			var xmin = XAC.getParameterByName('xmin', FORTE.xmlhttp.responseText);
			var ymin = XAC.getParameterByName('ymin', FORTE.xmlhttp.responseText);
			var dir = XAC.getParameterByName('dir', FORTE.xmlhttp.responseText);

			var postfix = FORTE.thisQuery == FORTE.QUERYANALYZE ? 'analyzed' : 'optimized';
			var resultVoxelGrid = dir + '/' + name + '_' + postfix + '.vxg';
			var resultDisp = dir + '/' + name + '_' + postfix + '.disp';

			if (FORTE.voxelGrid != undefined) {
				FORTE.voxelGrid.clear();
			}
			FORTE.voxelGrid = new FORTE.VoxelGrid(FORTE.canvasScene, new THREE.Vector3(
				parseFloat(xmin), parseFloat(ymin), 5));

			XAC.readTextFile(resultVoxelGrid, function(dataVoxelGrid) {
				if (dataVoxelGrid == undefined) return;

				FORTE.voxelGrid.load(dataVoxelGrid, dimVoxel);
				if (FORTE.thisQuery == FORTE.QUERYANALYZE) {
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
				} else if (FORTE.thisQuery == FORTE.QUERYOPTIMIZE) {
					FORTE.voxelGrid.render(false);
				}
			});
		}
	}

	//	init an empty design
	//	TODO: might need to be temp removed for testing
	FORTE.design = new FORTE.Design(FORTE.canvasRenderer.domElement, FORTE.canvasScene, FORTE.canvasCamera);
	FORTE.design.setInkSize(0.1);

	// FORTE.dragnDrop();

	// finally do unit test
	unitTest();
});

//
//	switching between different layers
//
FORTE.switchLayer = function(layer) {
	if (FORTE.layer == layer) {
		return;
	}

	// clean up mess from the previous layer
	switch (FORTE.layer) {
		case FORTE.FORMLAYER:
			// nothing
			break;
		case FORTE.FUNCSPECLAYER:
			// fade func elms
			// for (var i = 0; i < FORTE.design._funcElements.length; i++) {
			// 	FORTE.design._funcElements[i].material.opacity = FORTE.design._opacityHalf;
			// }
			break;
		case FORTE.FEEDBACKLAYER:
			// hide the feedback-specific slider
			// replace heatmap with normal design visual
			break;
		case FORTE.SUGGESTIONLAYER:
			// hide the two suggestion-specific sliders
			break;
		case FORTE.FABRICATIONLAYER:
			// remove the generated profile
			break;
	}

	FORTE.layer = layer;

	// set up new layer
	switch (FORTE.layer) {
		case FORTE.FORMLAYER:
			log('form layer')
			FORTE.design._mode = FORTE.Design.SKETCH;
			$(FORTE.canvasRenderer.domElement).css('cursor', 'crosshair');
			break;
		case FORTE.FUNCSPECLAYER:
			log('functional specification layer')
			$(FORTE.canvasRenderer.domElement).css('cursor', 'context-menu');
			FORTE.design._mode = FORTE.Design.LOADPOINT;
			// unfade func elms
			// for (var i = 0; i < FORTE.design._funcElements.length; i++) {
			// 	FORTE.design._funcElements[i].material.opacity = FORTE.design._opacityFull;
			// }
			break;
		case FORTE.FEEDBACKLAYER:
			log('feedback layer')
			$(FORTE.canvasRenderer.domElement).css('cursor', 'crosshair');
			break;
		case FORTE.SUGGESTIONLAYER:
			log('suggestion layer')
			$(FORTE.canvasRenderer.domElement).css('cursor', 'pointer');
			// lock design
			break;
		case FORTE.FABRICATIONLAYER:
			log('fabrication layer')
			$(FORTE.canvasRenderer.domElement).css('cursor', 'pointer');
			// lock design
			break;
	}
}

FORTE.transformOptimization = function(optimization, center, dim, w, h) {
	var origin = center.clone().sub(new THREE.Vector3(w / 2, h / 2, 0).multiplyScalar(dim)).toArray();
	// addABall(FORTE.canvasScene, new THREE.Vector3().fromArray(origin), 0xff0000, 5, 1)
	for (var i = 0; i < optimization.length; i++) {
		var edge = optimization[i];
		edge.node1.times(dim).add(origin);
		edge.node2.times(dim).add(origin);
		for (var j = 0; j < edge.points.length; j++) {
			edge.points[j].times(dim).add(origin);
		}

		for (var j = 0; j < edge.thickness.length; j++) {
			edge.thickness[j] *= dim;
		}

		// var len = edge.points.length;
		// var merged = FORTE.mergePoints(edge.points, edge.thickness);
		// edge.points = merged.points;
		// edge.thickness = merged.thicknesses;
		// log([len, edge.points.length])
	}
}

FORTE.mergePoints = function(points, thicknesses) {
	// remove temp ink, compute their circumference
	var lenTotal = 0;
	for (var i = points.length - 1; i >= 0; i--) {
		if (i > 0)
			lenTotal += XAC.getDist(points[i], points[i - 1]);
	}

	// merge points that are too close to each other
	var mergedPoints = [];
	var mergedThickness = [];
	var minSpacing = Math.min(lenTotal / 50, 3);

	mergedPoints.push(points[0]);
	mergedThickness.push(thicknesses[0]);
	for (var i = 1; i < points.length - 2; i++) {
		var p0 = points[i].clone();
		var p = p0.clone();
		var t = thicknesses[i];
		var cnt = 1;
		while (i < points.length - 2 && XAC.getDist(points[i + 1], p0) < minSpacing) {
			i++;
			p.add(points[i]);
			t += thicknesses[i]
			cnt++;
		}
		mergedPoints.push(p.times(1 / cnt));
		mergedThickness.push(t / cnt);
		log(t / cnt)
	}
	mergedPoints.push(points.slice(-1)[0]);
	mergedThickness.push(thicknesses.slice(-1)[0]);

	return {
		points: mergedPoints,
		thicknesses: mergedThickness
	};
}

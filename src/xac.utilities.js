//	........................................................................................................
//
//	useful recurring routines, v0.1
//
//  by xiangchen@acm.org, 06/2017
//
//	........................................................................................................

var XAC = XAC || {};

function log(msg) {
	console.log(msg);
}

function time(desc) {
	var t = new Date().getTime();
	if (XAC.t != undefined && desc != undefined) {
		console.info(desc + ': ' + (t - XAC.t) + ' ms');
	}
	XAC.t = t;
	return t;
}


//
//	load models from stl binary/ascii data
//
XAC.loadStl = function (data, onStlLoaded) {
	var stlLoader = new THREE.STLLoader();
	var geometry = stlLoader.parse(data);
	var object = new THREE.Mesh(geometry, XAC.MATERIALNORMAL);
	// XAC.scene.add(object.clone());

	var dims = getBoundingBoxDimensions(object);
	var ctr = getBoundingBoxCenter(object);

	// reposition the ground & grid
	XAC.ground.position.y -= dims[1];

	XAC.scene.remove(XAC.grid);
	XAC.grid = XAC.drawGrid(dims[1]);
	XAC.scene.add(XAC.grid);

	// relocate the camera
	var r = Math.max(25, getBoundingSphereRadius(object));
	XAC.camera.position.copy(XAC.posCam.clone().normalize().multiplyScalar(r * 2));

	// re-lookAt for the camera
	XAC.mouseCtrls.target = new THREE.Vector3(0, 0, 0);

	// store the object
	XAC.objects.push(object);

	if (onStlLoaded != undefined) {
		onStlLoaded(object);
	}
}

//
//	sending web sockets to a server
//
XAC.pingServer = function (xmlhttp, host, port, keys, values) {
	var prefix = "http://";
	xmlhttp.open("POST", prefix + host + ":" + port, true);
	xmlhttp.setRequestHeader("Content-type", "text/html");

	var strMsg = '?';
	if (keys == undefined || values == undefined) {
		xmlhttp.send();
	} else {
		for (var i = 0; i < keys.length; i++) {
			strMsg += keys[i] + '=' + values[i];
			if (i < keys.length - 1) {
				strMsg += '&';
			}
		}
		xmlhttp.send(strMsg);
	}
}

//
//
//
XAC.getParameterByName = function (name, url) {
	var match = RegExp('[?&]' + name + '=([^&]*)').exec(url);
	return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

//
//	read text file from local path
//
XAC.readTextFile = function (file, onSuccess, onFailure) {
	var rawFile = new XMLHttpRequest();
	rawFile.open("GET", file, false);
	rawFile.onreadystatechange = function () {
		if (rawFile.readyState === 4) {
			if (rawFile.status === 200 || rawFile.status == 0) {
				if (onSuccess != undefined) onSuccess(rawFile.responseText);
				return true;
			}
		}

		if (onFailure != undefined) onFailure();
		return false;
	}

	rawFile.send(null);
}

//
//	get heatmap like color based on -
//	@param	score
//	@param	maxScore
//
XAC.getHeatmapColor = function(score, maxScore) {
	// ceiling the score by maxScore
	score = Math.min(score, maxScore);

	// var colorSchemes = [0xa50026, 0xd73027, 0xf46d43, 0xfdae61, 0xfee08b,
	// 	0xffffbf, 0xd9ef8b, 0xa6d96a, 0x66bd63, 0x1a9850, 0x006837
	// ]
	var colorSchemes = ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b',
		'#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'
	]
	colorSchemes.reverse();
	var color = new THREE.Color(0xffffff);
	for (var k = 0; k < colorSchemes.length; k++) {
		if (score <= maxScore * (k + 1) / colorSchemes.length) {
			return colorSchemes[k];
		}
	}
}
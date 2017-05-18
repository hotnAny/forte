//	........................................................................................................
//
//	useful recurring routines, v0.0
//
//  by xiangchen@acm.org, 05/2017
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
XAC.loadStl = function(data, onStlLoaded) {
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
XAC.pingServer = function(xmlhttp, host, port, keys, values) {
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
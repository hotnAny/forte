/*------------------------------------------------------------------------------------*
 *
 * useful recurring routines
 *
 * by xiang 'anthony' chen, xiangchen@acm.org
 *
 *------------------------------------------------------------------------------------*/

var XAC = XAC || {};

XAC.Utilities = {};

function log(msg) {
	console.log(msg);
}

function err(msg) {
	console.error(msg);
}

/*
	load models from stl binary/ascii data
*/
function loadStl(data) {
	var stlLoader = new THREE.STLLoader();
	var geometry = stlLoader.parse(data);
	var object = new THREE.Mesh(geometry, MATERIALNORMAL);
	scene.add(object);

	var dims = getBoundingBoxDimensions(object);
	var ctr = getBoundingBoxCenter(object);

	// reposition the ground & grid
	gGround.position.y -= dims[1] * 0.55;

	scene.remove(gGrid);
	gGrid = drawGrid(dims[1] * 0.55);
	scene.add(gGrid);

	// relocate the camera
	var r = Math.max(25, getBoundingSphereRadius(object));
	camera.position.copy(gPosCam.clone().normalize().multiplyScalar(r * 2));

	// re-lookAt for the camera
	gMouseCtrls.target = new THREE.Vector3(0, 0, 0);

	// store the object
	objects.push(object);

}

function addALine(scene, v1, v2, clr) {
	clr = clr == undefined ? 0xff0000 : clr;

	var geometry = new THREE.Geometry();
	geometry.vertices.push(v1);
	geometry.vertices.push(v2);
	var material = new THREE.LineBasicMaterial({
		color: clr
	});
	var line = new THREE.Line(geometry, material);

	scene.add(line);
	// addABall(v1);
	return line;
}

var gBalls = [];

function addABall(scene, pt, clr, radius, opacity) {
	clr = clr == undefined ? 0xff0000 : clr;
	radius = radius == undefined ? 1 : radius;

	var geometry = new THREE.SphereGeometry(radius, 32, 32);
	var material = new THREE.MeshBasicMaterial({
		color: clr,
		transparent: true,
		opacity: opacity
	});
	var ball = new THREE.Mesh(geometry, material);
	ball.position.set(pt.x, pt.y, pt.z);

	// gBalls.push(ball);
	scene.add(ball);

	return ball;
}

XAC.float2int = function(value) {
	return value | 0;
}


XAC.getAvg = function(values) {
	if (values == undefined) {
		err('[getAvg]: input variable not an array')
		return;
	}

	if (values.length <= 0) {
		err('[getAvg]: input arrays contain no values')
		return;
	}

	var sum = 0;
	for (var i = values.length - 1; i >= 0; i--) {
		if (isNaN(values[i])) {
			err('[getAvg]: input arrays contain not numbers')
			return;
		}
		sum += values[i];
	}

	return sum / values.length;
}

XAC.getStd = function(values, avg) {
	if (avg == undefined) {
		avg = XAC.getAvg(values);
	}

	if (values == undefined) {
		err('[getStd]: input variable not an array')
		return;
	}

	if (values.length <= 1) {
		err('[getStd]: input arrays contain too few values')
		return;
	}

	var sqsum = 0;
	for (var i = values.length - 1; i >= 0; i--) {
		if (isNaN(values[i])) {
			err('[getStd]: input arrays contain not numbers')
			return;
		}
		sqsum += Math.pow(values[i] - avg, 2);
	}

	return Math.sqrt(sqsum / (values.length - 1));
}

function getMedian(values) {
	if (values == undefined) {
		err('[getMedian]: input variable not an array')
		return;
	}

	if (values.length <= 0) {
		err('[getMedian]: input arrays contain no values')
		return;
	}

	var vals = [];
	for (var i = values.length - 1; i >= 0; i--) {
		if (isNaN(values[i])) {
			err('[getMedian]: input arrays contain not numbers')
			return;
		}
		vals.push(values[i]);
	}

	vals.sort();
	return vals[vals.length / 2];
}

XAC.getMax = function(values) {
	if (values == undefined) {
		err('[getMax]: input variable not an array')
		return;
	}

	if (values.length <= 0) {
		err('[getMax]: input arrays contain no values')
		return;
	}

	var max = Number.MIN_VALUE;
	for (var i = values.length - 1; i >= 0; i--) {
		if (isNaN(values[i])) {
			err('[getMax]: input arrays contain not numbers')
			return;
		}
		max = Math.max(values[i], max);
	}

	return max;
}

XAC.removeFromArray = function(array, elm, compFunc) {
	var toRemove = [];
	for (var i = array.length - 1; i >= 0; i--) {
		var equal = undefined;
		if (compFunc != undefined) {
			equal = compFunc(elm, array[i]);
		} else {
			equal = elm == array[i];
		}

		if (equal) {
			toRemove.push(i);
		}
	}

	for (var i = toRemove.length - 1; i >= 0; i--) {
		array.splice(toRemove[i], 1);
	}

	return array;
}

XAC.addAnArrow = function(scene, v1, dir, len, r, mat) {
	var flipped = len < 0;

	// NOW: make an arrow
	var rArrow = r == undefined ? 1.5 : r;
	var lArrow = len == undefined ? 100 : Math.abs(len);
	var bodyArrow = new XAC.Cylinder(rArrow, lArrow,
		mat == undefined ? XAC.MATERIALFOCUS : mat).m;

	var rArrowHead = rArrow * 3;
	var headArrow = new XAC.Cylinder({
		r1: 0,
		r2: rArrowHead
	}, rArrowHead * 2, mat == undefined ? XAC.MATERIALFOCUS : mat).m;
	headArrow.position.add(new THREE.Vector3(0, 1, 0).multiplyScalar(lArrow * 0.5 +
		rArrowHead));

	var arrow = new THREE.Object3D();
	arrow.add(bodyArrow);
	arrow.add(headArrow);

	XAC.rotateObjTo(arrow, dir.clone().normalize().multiplyScalar(flipped == true ?
		-1 : 1));
	arrow.position.copy(v1.clone().add(dir.clone().normalize().multiplyScalar(
		lArrow * 0.5 + (flipped == true ? rArrowHead * 2 : 0))));

	scene.add(arrow);
	return arrow;
}

//
//	sending web sockets to a server
//
XAC.pingServer = function(xmlhttp, host, port, keys, values) {
	var prefix = "http://";
	xmlhttp.open("POST", prefix + host + ":" + port, true);
	xmlhttp.setRequestHeader("Content-type", "text/html");
	// wait forever

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
//	read text file from local path
//
XAC.readTextFile = function(file, followup) {
	var rawFile = new XMLHttpRequest();
	rawFile.open("GET", file, false);
	rawFile.onreadystatechange = function() {
		if (rawFile.readyState === 4) {
			if (rawFile.status === 200 || rawFile.status == 0) {
				if (followup != undefined) followup(rawFile.responseText);
			}
		}
	}
	rawFile.send(null);
}


XAC.getParameterByName = function(name, url) {
	var match = RegExp('[?&]' + name + '=([^&]*)').exec(url);
	return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

XAC.copyArray = function(array) {
	var arrayCopy = [];
	for (var i = 0; i < array.length; i++) {
		arrayCopy.push(array[i]);
	}
	return arrayCopy;
}


XAC.clamp = function(val, vmin, vmax) {
	if(vmin > vmax) {
		var vtmp = vmin;
		vmin = vmax;
		vmax = vtmp;
	}
	val = Math.max(vmin, val);
	val = Math.min(val, vmax);
	return val;
}

XAC.initMDArray = function(dims, val) {
	if (dims.length == 1) {
		return new Array(dims[0]).fill(val);
	}

	var array = [];
	for (var i = 0; i < dims[0]; i++) {
		array.push(XAC.initMDArray(dims.slice(1), val));
	}
	return array;
}

Array.prototype.clone = function() {
	var arr = [];
	for (var i = 0; i < this.length; i++) {
		arr.push(this[i]);
	}
	return arr;
}

Array.prototype.add = function(arr, sign) {
	if(arr == undefined) return;
	sign = sign || 1;
	var len = Math.min(this.length, arr.length);
	for(var i=0; i<len; i++) {
		this[i] += sign * arr[i];
	}
	return this;
}

Array.prototype.addScalar = function(s) {
	for(var i=0; i<this.length; i++) {
		this[i] += s;
	}
	return this;
}

Array.prototype.sub = function(arr) {
	return this.add(arr, -1);
}

Array.prototype.times = function(s) {
	for(var i=0; i<this.length; i++) {
		this[i] *= s;
	}
	return this;
}

Array.prototype.copy = function(arr) {
	this.splice(0, this.length);
	for (var i = 0; i < arr.length; i++) {
		this.push(arr[i]);
	}
}

Math.getBaseLog = function(x, y) {
	return Math.log(y) / Math.log(x);
}

/*
	math routines

	requiring numeric.js and three.js
*/

/*
	assuming @param points is THREE.Vector3, or something that has x, y, z components
	ref: http://stackoverflow.com/questions/10900141/fast-plane-fitting-to-many-points
	svd related: http://www.mathworks.com/help/matlab/ref/svd.html
*/

var XAC = XAC || {};

/*
	get the euclidean distance between two R^d points
*/
XAC.getDist = function(p1, p2) {
	var len = Math.min(p1.length, p2.length);
	var d = 0;
	for (var i = len - 1; i >= 0; i--) {
		d += Math.pow(p1[i] - p2[i], 2);
	}

	return Math.sqrt(d);
}

function pts2pl(points) {
	var G = [];

	for (var i = 0; i < points.length; i++) {
		G.push([points[i].x, points[i].y, points[i].z, 1]);
	}

	var usv = numeric.svd(G);

	var a = usv.V[0][3];
	var b = usv.V[1][3];
	var c = usv.V[2][3];
	var d = usv.V[3][3];

	return {
		A: a,
		B: b,
		C: c,
		D: d
	};
}

/*
	project a set of points onto an axis and get the range
*/
function pjr(points, axis) {
	var min = 1000;
	var max = -1000;

	for (var i = 0; i < points.length; i++) {
		var val = axis.dot(points[i]);
		min = Math.min(min, val);
		max = Math.max(val, max);
	}

	return [min, max];
}

/*
	get a plance from a point and two vectors
*/
function pvv2pl(pt, v1, v2) {
	var cp = new THREE.Vector3().crossVectors(v1, v2);

	var a = cp.x;
	var b = cp.y;
	var c = cp.z;
	var d = -a * pt.x - b * pt.y - c * pt.z;

	return {
		A: a,
		B: b,
		C: c,
		D: d
	};
}


/*
	get the projection coordinates of a point on a given plane parameterized by ax+by+cz+d=0
*/
function ptonpl(v, a, b, c, d) {
	var t = -(a * v.x + b * v.y + c * v.z + d) / (a * a + b * b + c * c);
	return new THREE.Vector3(v.x + a * t, v.y + b * t, v.z + c * t);
}

/*
	?
*/
function getVerticalOnPlane(v, a, b, c, d) {
	var ux = c * v.y - b * v.z;
	var uy = a * v.z - c * v.x;
	var uz = b * v.x - a * v.y;
	return new THREE.Vector3(ux, uy, uz).normalize();
}

//
//	triangle area
//
function ta(va, vb, vc) {
	var ab = vb.clone().sub(va);
	var ac = vc.clone().sub(va);

	var x1 = ab.x,
		x2 = ab.y,
		x3 = ab.z,
		y1 = ac.x,
		y2 = ac.y,
		y3 = ac.z;

	return 0.5 * Math.sqrt(
		Math.pow((x2 * y3 - x3 * y2), 2) +
		Math.pow((x3 * y1 - x1 * y3), 2) +
		Math.pow((x1 * y2 - x2 * y1), 2)
	);
}

//
//	distance from a point to a line segment defined by two vertices
//
//	(for now) return undefined if not projecting on the segment
//
function p2ls(x, y, z, x1, y1, z1, x2, y2, z2) {
	var v10 = new THREE.Vector3(x - x1, y - y1, z - z1);
	var v12 = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
	var dp1 = v10.dot(v12.clone().normalize());

	var v20 = new THREE.Vector3(x - x2, y - y2, z - z2);
	var v21 = v12.clone().multiplyScalar(-1);
	var dp2 = v20.dot(v21.clone().normalize());

	var l12 = v12.length();

	if (dp1 <= l12 && dp2 <= l12) {
		return p2l(x, y, z, x1, y1, z1, x2, y2, z2);
	} else {
		return undefined;
	}
}

//
// in R^3, distance from a point (x, y, z) to a line defined by (x1, y1, z1) and (x2, y2, z2)
//
// ref: http://mathworld.wolfram.com/Point-LineDistance3-Dimensional.html
//
function p2l(x, y, z, x1, y1, z1, x2, y2, z2) {
	x *= 1.0
	y *= 1.0
	z *= 1.0

	x1 *= 1.0
	y1 *= 1.0
	z1 *= 1.0

	x2 *= 1.0
	y2 *= 1.0
	z2 *= 1.0

	var dx1 = x1 - x
	var dy1 = y1 - y
	var dz1 = z1 - z
	var dx2 = x2 - x
	var dy2 = y2 - y
	var dz2 = z2 - z
	var tu = (dx2 - dx1) * dx1 + (dy2 - dy1) * dy1 + (dz2 - dz1) * dz1
	var tb = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1)
	var t = -tu / tb

	var dist = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1 - tu * tu / tb);
	var proj = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z1 + (z2 - z1) * t];

	return {
		distance: dist,
		projection: proj
	};
}

// p, q are points, u, v are vectors, all in three.js
// p shoots out u, q shoots out v, what's the intersection
function vectorsIntersection(p, u, q, v) {
	var A = numeric.transpose([u.toArray(), v.clone().multiplyScalar(-1).toArray()]);
	var b = numeric.transpose([new THREE.Vector3().subVectors(q, p).toArray()]);
	var Ainv = numeric.inv(A);
	if (Ainv == undefined) {
		err('matrix not invertible!');
		return undefined;
	}
	var x = numeric.transpose(numeric.dot(Ainv, b))[0];
	return p.clone().add(u.clone().multiplyScalar(x[0]));
}

/*
	fitting a circle to a set of (x, y) points

	@author
		xiang 'anthony' chen, xiangchen@acm.org
	@return
		center of the circle: (xCtr, y0)
		radius of the circle: radius
		err: mean square error
	@references
		http://jsxgraph.uni-bayreuth.de/wiki/index.php/Least-squares_circle_fitting
*/
XAC.fitCircle = function(p) {
	var M = [],
		X = [],
		Y = [],
		y = [],
		MT, B, c, z, n, l;

	n = p.length;
	l = 0;

	for (i = 0; i < n; i++) {
		M.push([p[i][0], p[i][1], p[i][2], 1.0]);
		y.push(p[i][0] * p[i][0] + p[i][1] * p[i][1] + p[i][2] * p[i][2]);

		if (i > 0) {
			l += XAC.getDist(p[i], p[i - 1]);
		}
	}

	MT = numeric.transpose(M);
	B = numeric.dot(MT, M);
	c = numeric.dot(MT, y);
	z = numeric.solve(B, c);

	var xm = z[0] * 0.5;
	var ym = z[1] * 0.5;
	var zm = z[2] * 0.5;
	var r = Math.sqrt(z[2] + xm * xm + ym * ym + zm * zm);

	/*
		computing errors
	*/
	var err = 0;
	for (i = 0; i < n; i++) {
		var d = XAC.getDist(p[i], [xm, ym, zm]);
		var subErr = (d - r) * (d - r);
		// console.log("subErr " + subErr);
		err += subErr;
	}

	//
	//	newbies
	//
	err = Math.sqrt(err / n);

	//
	//	oldies
	//
	// err = Math.sqrt(err / n) * (2 * Math.PI * r) / l;

	console.log("fitting circle error: " + err);

	return {
		x0: xm,
		y0: ym,
		z0: zm,
		r: r,
		err: err,
		l: l
	};
}

/*
	fitting a straight line to a set of (x, y) points in p

	@author
		xiang 'anthony' chen, xiangchen@acm.org
	@return
		b0, b1 where y = b0 + b1 * x,
		err: mean square error
	@references
		http://www.stat.purdue.edu/~jennings/stat514/stat512notes/topic3.pdf
*/
XAC.fitLine = function(p) {
	var X = [],
		Xt, Y = [],
		b;
	n = p.length;
	for (i = 0; i < n; i++) {
		X.push([1, p[i][0]]);
		Y.push(p[i][1]);
	}

	Xt = numeric.transpose(X);
	var XtX = numeric.dot(Xt, X);
	var XtY = numeric.dot(Xt, Y);
	b = numeric.solve(XtX, XtY);

	/*
		computing errors
	*/
	var err = numeric.norm2(numeric.sub(numeric.dot(X, b), Y));
	err = Math.sqrt(err * err / n);
	console.log("fitting line error: " + err);

	return {
		b0: b[0],
		b1: b[1],
		err: err
	};
}

/*
	distance between two points
*/
function dist(x0, y0, x1, y1) {
	return Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
}

/*
	rotate a vector by theta (radian)
*/
function rotateVector(v, theta) {
	var cos = Math.cos(theta);
	var sin = Math.sin(theta);
	var R = [
		[cos, -sin],
		[sin, cos]
	];
	return numeric.dot(R, v);
}

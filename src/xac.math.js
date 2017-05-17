// .................................................................
//
//  math library v0.2
//
//  by xiangchen@acm.org, 05/2017
//
//  NOTE:
//  - [dependency] numeric.js (http://www.numericjs.com/)
//  - [dependency] three.js (https://threejs.org/)
//  - [dependency] earcut.js (https://github.com/mapbox/earcut)
//
// .................................................................

//
//  extensions for numeric.js
//

// compute the Frobenius norm of a matrix
numeric.fnorm = function(matrix) {
    var sum = 0;
    for (var i = 0; i < matrix.length; i++) {
        for (var j = 0; j < matrix[i].length; j++) {
            sum += Math.pow(matrix[i][j], 2);
        }
    }
    return Math.sqrt(sum);
}

// print a matrix
numeric.print = function(matrix) {
    var strMatrix = ""
    for (var i = 0; i < matrix.length; i++) {
        for (var j = 0; j < matrix[i].length; j++) {
            strMatrix += parseFloat(matrix[i][j]).toFixed(4) + ' ';
        }
        strMatrix += '\n'
            // strMatrix += matrix[i] + '\n';
    }
    console.log(strMatrix);
}

// times a matrix (including vector) by a scalar
numeric.times = function(matrix, scalar) {
    for (var i = 0; i < matrix.length; i++) {
        for (var j = 0; j < matrix[i].length; j++) {
            matrix[i][j] *= scalar;
        }
    }
    return matrix;
}

//
// TODO comment
//
numeric.fromBlocks = function(blocks) {
    var dim = numeric.dim(blocks).slice(0, 2);
    var dimBlock = numeric.dim(blocks[0][0]).slice(0, 2);
    var x = XAC.initMDArray([dim[0] * dimBlock[0], dim[1] * dimBlock[1]], 0);
    for (var i = 0; i < dim[0]; i++) {
        for (var j = 0; j < dim[1]; j++) {
            var from = [i * dimBlock[0], j * dimBlock[1]];
            var to = [from[0] + dimBlock[0] - 1, from[1] + dimBlock[1] - 1];
            x = numeric.setBlock(x, from, to, blocks[i][j]);
        }
    }
    // numeric.print(x)
    return x;
}

//
//  other math-related useful functions
//
XAC.getRangeOfPointsOnAxis = function(points, axis) {
    var min = 1000;
    var max = -1000;

    for (var i = 0; i < points.length; i++) {
        var val = axis.dot(points[i]);
        min = Math.min(min, val);
        max = Math.max(val, max);
    }

    return [min, max];
};

//
//	get the projection coordinates of a point on a given plane parameterized by ax+by+cz+d=0
//
XAC.getPointProjectionOnPlane = function(v, a, b, c, d) {
    var t = -(a * v.x + b * v.y + c * v.z + d) / (a * a + b * b + c * c);
    return new THREE.Vector3(v.x + a * t, v.y + b * t, v.z + c * t);
}


//
//  testing whether a triangle and a box intersect in 3D space,
//	based on saparating axis theorem
//	ref: http://fileadmin.cs.lth.se/cs/Personal/Tomas_Akenine-Moller/pubs/tribox.pdf
//
XAC.testTriBoxIntersection = function(va, vb, vc, nml, bbox) {
    var minmax;

    /* test the 3 box normals */
    var boxNormals = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    var boxMin = [bbox.min.x, bbox.min.y, bbox.min.z];
    var boxMax = [bbox.max.x, bbox.max.y, bbox.max.z];

    for (var i = 0; i < 3; i++) {
        minmax = XAC.getRangeOfPointsOnAxis([va, vb, vc], boxNormals[i]);
        if (minmax[1] < boxMin[i] || minmax[0] > boxMax[i]) {
            return false;
        }
    }


    /* test the 1 triangle normal */
    var boxVertices = new Array();
    var xs = [bbox.min.x, bbox.max.x];
    var ys = [bbox.min.y, bbox.max.y];
    var zs = [bbox.min.z, bbox.max.z];

    for (var ix = 0; ix < 2; ix++) {
        for (var iy = 0; iy < 2; iy++) {
            for (var iz = 0; iz < 2; iz++) {
                boxVertices.push(new THREE.Vector3(xs[ix], ys[iy], zs[iz]));
            }
        }
    }

    var triOffset = nml.dot(va);
    minmax = XAC.getRangeOfPointsOnAxis(boxVertices, nml);
    if (minmax[1] < triOffset || minmax[0] > triOffset) {
        return false;
    }


    /* test the 9 edge cross products */
    var triEdges = [new THREE.Vector3().subVectors(va, vb),
        new THREE.Vector3().subVectors(vb, vc),
        new THREE.Vector3().subVectors(vc, va)
    ];

    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            var axis = new THREE.Vector3().crossVectors(triEdges[i], boxNormals[j]);
            var boxMinmax = XAC.getRangeOfPointsOnAxis(boxVertices, axis);
            var triMinmax = XAC.getRangeOfPointsOnAxis([va, vb, vc], axis);
            if (boxMinmax[1] < triMinmax[0] || boxMinmax[0] > triMinmax[1]) {
                return false;
            }
        }
    }

    return true;
}

//
//  get the max amongst all the input vars
//
XAC.max = function() {
    var maxVal = Number.MIN_VALUE;
    for (var i = 0; i < arguments.length; i++) {
        maxVal = Math.max(maxVal, arguments[i]);
    }
    return maxVal;
}

XAC.min = function() {
    var minVal = Number.MAX_VALUE;
    for (var i = 0; i < arguments.length; i++) {
        minVal = Math.min(minVal, arguments[i]);
    }
    return minVal;
}

//
//  whether p1 and p2 are on the same side of the segment ab
//
XAC.onSameSide = function(p1, p2, a, b) {
    var ab = b.clone().sub(a);
    var cp1 = ab.clone().cross(p1.clone().sub(a));
    var cp2 = ab.cross(p2.clone().sub(a));

    var isSameSide = false;
    // if at least one point is not on ab
    if (cp1.length() != 0 || cp2.length != 0)
        isSameSide = cp1.dot(cp2) > 0;
    // if both points are on ab
    else
        isSameSide = true;

    return isSameSide;
}

//
//  whether v is in a triangle defined by va, vb and vc
//
XAC.isInTriangle = function(v, va, vb, vc) {
    return XAC.onSameSide(v, va, vb, vc) &&
        XAC.onSameSide(v, vb, va, vc) &&
        XAC.onSameSide(v, vc, va, vb);
}

//
//  force an input val to be between vmin and vmax
//
XAC.clamp = function(val, vmin, vmax) {
    if (vmin > vmax) {
        var vtmp = vmin;
        vmin = vmax;
        vmax = vtmp;
    }
    val = Math.max(vmin, val);
    val = Math.min(val, vmax);
    return val;
}

//
// get triangle area
//
XAC.triangleArea = function(va, vb, vc) {
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

/*
	assuming @param points is THREE.Vector3, or something that has x, y, z components
	ref: http://stackoverflow.com/questions/10900141/fast-plane-fitting-to-many-points
	svd related: http://www.mathworks.com/help/matlab/ref/svd.html
*/
XAC.findPlaneToFitPoints = function(points) {
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

//
//  test whether a triangle intersects with a cylinder
//
//  - va, vb, vc: vertices of the triangle
//  - c: center of the cylinder
//  - nml: normal of the cylinder (normalized vector of the axis)
//  - h, r: height and radius of the cylinder
//
XAC.testTriCylIntersection = function(va, vb, vc, c, nml, h, r) {
    nml = nml.normalize();
    var vertices = [va, vb, vc];

    // a triangle intersects with a cylinder if
    // 1) cylinder's axis intersects with triangle; or
    var paramPlane = XAC.getPlaneFromPointVectors(va, new THREE.Vector3().subVectors(vb, va), new THREE
        .Vector3().subVectors(vc, va));
    var intersection = XAC.findLinePlaneIntersection(c, c.clone().add(nml),
        paramPlane.A, paramPlane.B, paramPlane.C, paramPlane.D);
    if (intersection != undefined && c.distanceTo(intersection) < h / 2 && XAC.isInTriangle(
            intersection, va, vb, vc)) {
        return true;
    }

    // 2) at least one edge intersects with cylinder
    var top = c.clone().add(nml.clone().multiplyScalar(h / 2));
    var bottom = c.clone().add(nml.clone().multiplyScalar(-h / 2));
    var heightProj = XAC.getRangeOfPointsOnAxis([bottom, top], nml);
    for (var i = 0; i < vertices.length; i++) {
        v1 = vertices[i];
        v2 = vertices[(i + 1) % vertices.length];

        // v1v2's projection on cylinder's axis falls into the height range
        var proj = XAC.getRangeOfPointsOnAxis([v1, v2], nml);
        if (proj[0] > heightProj[1] || proj[1] < heightProj[0]) {
            continue;
        }

        // v1v2's distance to cylinder's axis smaller than radius
        var dist = XAC.distanceBetweenLineSegments(v1, v2, bottom, top);
        if (dist < r) {
            return true;
        }
    }

    return false;
}

//
//  find intersection between a line and a plane
//  - p0, p1 represent the line segment
//  - a, b, c, d represent the plane
//  - if isSegment==true, do not consider points outside of segment p0p1
//  ref: http://geomalgorithms.com/a05-_intersect-1.html
//
XAC.findLinePlaneIntersection = function(p0, p1, a, b, c, d, isSegment) {
    var pointNormal = XAC.pointNormalOfPlane(a, b, c, d);
    var eps = 10e-3;

    // a b c d represent a plane
    if (pointNormal != undefined) {
        var v0 = pointNormal.point;
        var n = pointNormal.normal;
        var u = p1.clone().sub(p0);
        if (n.dot(u) != 0) {
            var w = p0.clone().sub(v0);
            var s1 = -n.dot(w) / n.dot(u);
            var int = v0.clone().add(new THREE.Vector3().addVectors(w, u.clone().multiplyScalar(s1)));
            if (isSegment && int.distanceTo(p0) + int.distanceTo(p1) > p0.distanceTo(p1) + eps) {
                return;
            }
            return int;
        }
    }
    // a b c d represent a point (0, 0, 0, 0)
    else if (p0.dot(p1) == 0) {
        return new THREE.Vector3(0, 0, 0);
    }
}

//
//  get the point-normal representation of a plane (a, b, c, d)
//
XAC.pointNormalOfPlane = function(a, b, c, d) {
    var x, y, z;
    if (a != 0) {
        y = a * (Math.random() + 0.5);
        z = a * (Math.random() + 0.5);
        x = -(b * y + c * z + d) / a;
    } else if (b != 0) {
        x = b * (Math.random() + 0.5);
        z = b * (Math.random() + 0.5);
        y = -(c * z + d) / b;
    } else if (c != 0) {
        x = c * (Math.random() + 0.5);
        y = c * (Math.random() + 0.5);
        z = -d / c;
    } else {
        return;
    }

    return {
        point: new THREE.Vector3(x, y, z),
        normal: new THREE.Vector3(a, b, c).normalize()
    }
}


//
//	get a plance from a point and two vectors
//
XAC.getPlaneFromPointVectors = function(pt, v1, v2) {
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

XAC.getPlaneFromPointNormal = function(p, nml) {
    return {
        A: nml.x,
        B: nml.y,
        C: nml.z,
        D: -p.dot(nml)
    };
}

//
//  get distance between two line segments u1u2 and v1v2
//
XAC.distanceBetweenLineSegments = function(u1, u2, v1, v2) {
    var u1u2 = u2.clone().sub(u1);
    var paramsu = XAC.getPlaneFromPointNormal(u1, u1u2);
    var projv1 = XAC.getPointProjectionOnPlane(v1, paramsu.A, paramsu.B, paramsu.C, paramsu.D);
    var projv2 = XAC.getPointProjectionOnPlane(v2, paramsu.A, paramsu.B, paramsu.C, paramsu.D);

    var v1v2 = v2.clone().sub(v1);
    var paramsv = XAC.getPlaneFromPointNormal(v1, v1v2);
    var proju1 = XAC.getPointProjectionOnPlane(u1, paramsv.A, paramsv.B, paramsv.C, paramsv.D);
    var proju2 = XAC.getPointProjectionOnPlane(u2, paramsv.A, paramsv.B, paramsv.C, paramsv.D);

    return Math.max(
        XAC.distanceBetweenPointLineSegment(u1, projv1, projv2),
        XAC.distanceBetweenPointLineSegment(v1, proju1, proju2));
}

//
//  get distance between a point p and a line segment v1v2
//
XAC.distanceBetweenPointLineSegment = function(p, v1, v2) {
    var axis = v2.clone().sub(v1).normalize();
    var projections = [axis.dot(v1), axis.dot(p), axis.dot(v2)];
    if ((projections[0] - projections[1]) * (projections[1] - projections[2]) >= 0) {
        var t = (projections[0] - projections[1]) / (projections[0] - projections[2]);
        return Math.sqrt(Math.pow(p.distanceTo(v1), 2) - Math.pow(v1.distanceTo(v2) * t, 2));
    } else {
        return Math.min(p.distanceTo(v1), p.distanceTo(v2));
    }
}

//
//  in 2d (xy space): whether a point p is inside a polygon that consists of an array of points
//
XAC.testPointInPolygon = function(p, poly) {
    var cnt = 0;
    // var cnts = [0, 0, 0, 0];
    var eps = 1e-6
    for (var i = 0; i < poly.length; i++) {
        var p1 = poly[i];
        var p2 = poly[(i + 1) % poly.length];

        if ((p1.x - p.x) * (p2.x - eps * Math.sign(p2.x - p1.x) - p.x) <= 0 && p1.y >= p.y && p2.y >= p
            .y) {
            cnt++;
            // cnts[0]++;
        }
    }

    return cnt % 2 == 1;
}

//
//  in 2d (xy space): return 1, 0 or -1 indicating which side a point is on (including on the line)
//
XAC.pointOnLineSide = function(p, p1, p2) {
    return Math.sign((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x));
}

//
//
//
XAC.find2DLineTriangleIntersections = function(p1, p2, v1, v2, v3) {
    var vertices = [v1, v2, v3];
    var intersections = [];
    for (var i = 0; i < vertices.length; i++) {
        var idx1 = i;
        var idx2 = (i + 1) % vertices.length;
        var infoInt = XAC.find2DLineLineIntersection(vertices[idx1], vertices[idx2], p1, p2);
        if (infoInt != undefined) {
            intersections.push({
                idx1: idx1,
                idx2: idx2,
                t: infoInt.t,
                s: infoInt.s,
                p: infoInt.p
            });
        }
    }

    // TODO: detect redundant points

    return intersections;
}

//
//
//
XAC.find2DLineLineIntersection = function(u1, u2, v1, v2) {
    var denom = (v2.y - v1.y) * (u2.x -
        u1.x) - (v2.x - v1.x) * (u2.y - u1.y);
    if (denom == 0) {
        return;
    }

    var t = ((v2.x - v1.x) * (u1.y - v1.y) - (v2.y - v1.y) * (u1.x - v1.x)) / denom;
    if (t < 0 || t > 1) {
        return;
    }

    var s = ((u2.x - u1.x) * (u1.y - v1.y) - (u2.y - u1.y) * (u1.x - v1.x)) / denom;
    if (s < 0 || s > 1) {
        return;
    }

    var p = u1.clone().add(u2.clone().sub(u1).multiplyScalar(t));
    return {
        p: p,
        t: t,
        s: s
    };
}

//
//  triangulate a polygon in 3D based on earcut.js
//  - polygon: an array of vertices
//  - normal: normal vector of a polygon
//  return the topology of the triangulation, e.g., [1,0,3, 3,2,1],
//      where each is an index to a vertex, three make a triangle
//
XAC.triangulatePolygon = function(polygon, normal) {
    // var polygonXY = polygon.clone();
    var vertices = [];
    var zAxis = new THREE.Vector3(0, 0, -1);
    var angleToRotate = normal.angleTo(zAxis);
    var axisToRotate = new THREE.Vector3().crossVectors(normal, zAxis).normalize();

    for (v of polygon) {
        var vtrans = v.clone().applyAxisAngle(axisToRotate, angleToRotate);
        vertices.push(vtrans.x, vtrans.y);
    }

    if (earcut == undefined) {
        console.error('missing library earcut.js');
    }

    return earcut(vertices);
}

//
//  fit an array of points in p to a circle
//
XAC.fitCircle = function(points) {
    var p = [];
    for (point of points) {
        p.push([point.x, point.y]);
    }

    var __dist = function(x0, y0, x1, y1) {
        return Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
    };

    var M = [],
        X = [],
        Y = [],
        y = [],
        MT, B, c, z, n, l;

    n = p.length;
    l = 0;

    for (i = 0; i < n; i++) {
        M.push([p[i][0], p[i][1], 1.0]);
        y.push(p[i][0] * p[i][0] + p[i][1] * p[i][1]);

        if (i > 0) {
            l += __dist(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]);
        }
    }

    MT = numeric.transpose(M);
    B = numeric.dot(MT, M);
    c = numeric.dot(MT, y);
    z = numeric.solve(B, c);

    var xm = z[0] * 0.5;
    var ym = z[1] * 0.5;
    var r = Math.sqrt(z[2] + xm * xm + ym * ym);


    /*
    	computing errors
    */
    var err = 0;
    for (i = 0; i < n; i++) {
        var x = p[i][0];
        var y = p[i][1];

        var d = __dist(x, y, xm, ym);

        var subErr = (d - r) * (d - r);

        // console.log("subErr " + subErr);
        err += subErr;
    }

    err = Math.sqrt(err / n);

    // console.log("fitting circle error: " + err);

    return {
        x0: xm,
        y0: ym,
        r: r,
        err: err,
        l: l
    };
}

//
//  fit an array of THREE.Vector3 points in p to a circle
//
XAC.fitSphere = function(points) {
    var p = [];
    for (point of points) {
        p.push([point.x, point.y, point.z]);
    }

    var M = [],
        X = [],
        Y = [],
        y = [],
        MT, B, c, z, n, l;

    n = p.length;

    for (i = 0; i < n; i++) {
        M.push([p[i][0], p[i][1], p[i][2], 1.0]);
        y.push(p[i][0] * p[i][0] + p[i][1] * p[i][1] + p[i][2] * p[i][2]);
    }

    MT = numeric.transpose(M);
    B = numeric.dot(MT, M);
    c = numeric.dot(MT, y);
    z = numeric.solve(B, c);

    var xm = z[0] * 0.5;
    var ym = z[1] * 0.5;
    var zm = z[2] * 0.5;
    var r = Math.sqrt(z[3] + xm * xm + ym * ym + zm * zm);

    return {
        x0: xm,
        y0: ym,
        z0: zm,
        r: r
    };
}

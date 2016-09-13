/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	Interpolation based on additive graph structure
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

FORTE.Interpolation = function(designOriginal, designNew, scene, camera) {
    this._scene = scene;
    this._dump = [];

    this.SNAPTONODES = false;

    this._designOriginal = designOriginal;
    this._designNew = designNew;

    this._graph = [];
    this._neighorsOriginal = undefined;

    this._buildDependencyGraph(this._designOriginal, this._designNew);
}

FORTE.Interpolation.prototype = {
    constructor: FORTE.Interpolation
};

FORTE.Interpolation.prototype.interpolate = function(t) {
    // clean up previous values
    for (var i = 0; i < this._graph.length; i++) {
        this._graph[i].node1 = [];
        this._graph[i].node2 = [];
        this._graph[i].edge = {
            points: [],
            thickness: []
        }
        this._graph[i].needsUpdate = true;
    }

    var designInterpolated = [];

    // 1st pass: update independent elements (nodes)
    for (var i = 0; i < this._graph.length; i++) {
        var elm = this._graph[i];
        var dps = [elm._dp1, elm._dp2];
        var _nodes = [elm._node1, elm._node2];
        var nodes = [elm.node1, elm.node2];
        for (var k = 0; k < dps.length; k++) {
            if (dps[k].isIndependent != true) continue;
            // elm will move along a path (geodestic)
            if (dps[k].path != undefined) {
                var idx = XAC.float2int(dps[k].path.length * t + 0.5);
                idx = XAC.clamp(idx, 0, dps[k].path.length - 1);
                if (idx < dps[k].path.length) nodes[k].copy(dps[k].path[idx]);
            }
            // elm will move in space (cartestian)
            else if (dps[k].projection != undefined) {
                nodes[k].copy(_nodes[k].clone().times(t).add(dps[k].projection.clone().times(1 - t)));
            }
        }
    }

    // 2nd pass: update dependent elements (nodes)
    for (var i = 0; i < this._graph.length; i++) {
        var elm = this._graph[i];
        if (elm.needsUpdate == true) {
            this._updateElm(elm, t);
        }

        designInterpolated.push({
            node1: elm.node1,
            node2: elm.node2,
            points: elm.edge.points,
            thickness: elm.edge.thickness
        });
    }

    return designInterpolated;
}

//
//
//  helper methods
//
//
FORTE.Interpolation.prototype._updateElm = function(elm, t) {
    var dps = [elm._dp1, elm._dp2];
    var _nodes = [elm._node1, elm._node2];
    var nodes = [elm.node1, elm.node2];

    for (var i = 0; i < dps.length; i++) {
        // sometimes an elm is partially updated (one node updated but the other not)
        if (nodes[i].length > 0) {
            continue;
        }

        // make sure its depend-upons are updated
        if (dps[i].elm.needsUpdate) {
            this._updateElm(dps[i].elm, t);
        }

        var edge = dps[i].elm.edge;
        if (edge == undefined) {
            edge = dps[i].elm;
            if (edge == undefined) continue;
        }

        var posSnapTo;
        if (dps[i].idxIntPnt == 0) {
            posSnapTo = edge.node1;
        } else if (dps[i].idxIntPnt == edge.points.length - 1) {
            posSnapTo = edge.node2;
        } else {
            posSnapTo = edge.points[dps[i].idxIntPnt];
        }
        if (posSnapTo != undefined) nodes[i].copy(posSnapTo);
    }

    var len = XAC.getDist(elm._node1, elm._node2) + XAC.EPSILON;
    var dnode1 = elm.node1.clone().sub(elm._node1);
    var dnode2 = elm.node2.clone().sub(elm._node2);
    for (var i = 0; i < elm._edge.points.length; i++) {
        var point = XAC.copyArray(elm._edge.points[i]);
        point.add(dnode1.clone().times(1 - i * 1.0 / (elm._edge.points.length - 1)));
        point.add(dnode2.clone().times(i * 1.0 / (elm._edge.points.length - 1)));
        elm.edge.points.push(point);
    }

    // TODO: interpolate thickness
    elm.edge.thickness.copy(elm._edge.thickness);
    // log(elm._edge.thickness)

    elm.needsUpdate = false;
}

FORTE.Interpolation.prototype._buildDependencyGraph = function(designOriginal, designNew) {
    var _initDependency = function() {
        return {
            idxElm: -1, // index of the elm in the graph (mostly for debug use)
            elm: undefined, // elm to depend upon
            idx: -1, // which point on the dependUpon is the closest
            projection: undefined,
            path: undefined
        };
    }

    //
    //  initialization
    //
    for (var idx = 0; idx < designNew.length; idx++) {
        var edge = designNew[idx];

        var elm = {
            // original stuff
            _id: idx,
            _node1: edge.node1,
            _node2: edge.node2,
            _edge: {
                points: XAC.copyArray(edge.points),
                thickness: XAC.copyArray(edge.thickness)
            },

            // connectivity, storing indices of neighbors
            _neighbors1: [],
            _neighbors2: [],

            // corresponded & projection stuff
            _dp1: _initDependency(),
            _dp2: _initDependency(),

            // interpolated stuff
            node1: [],
            node2: [],
            edge: {
                points: [],
                thickness: []
            }
        };

        //  building connectivity info
        var nodes = [elm._node1, elm._node2];
        var dps = [elm._dp1, elm._dp2];
        var neighbors = [elm._neighbors1, elm._neighbors2];
        for (var j = 0; j < nodes.length; j++) {
            var edgesInfo = this._getIntersectingEdge(nodes[j], designNew);
            for (var k = 0; k < edgesInfo.length; k++) {
                if (edgesInfo[k].idxEdge != idx) {
                    neighbors[j].push({
                        idxElm: edgesInfo[k].idxEdge,
                        idxIntPnt: edgesInfo[k].idxIntPnt
                    });
                }
            }
        }

        // decide which edge to project on
        var votes = XAC.initMDArray([designOriginal.length], 0);
        votes[this._project(designOriginal, elm._node1).idxEdge]++;
        votes[this._project(designOriginal, elm._node2).idxEdge]++;
        for (var j = 0; j < elm._edge.points.length; j++) {
            votes[this._project(designOriginal, elm._edge.points[j]).idxEdge]++;
        }

        var idxProjEdge = -1;
        var maxVote = Number.MIN_VALUE;
        for (var j = 0; j < votes.length; j++) {
            if (votes[j] > maxVote) {
                maxVote = votes[j];
                idxProjEdge = j;
            }
        }

        var projEdge = designOriginal[idxProjEdge];
        var v1 = new THREE.Vector3().fromArray(elm._node1.clone().sub(elm._node2));
        var v2 = new THREE.Vector3().fromArray(projEdge.node1.clone().sub(projEdge.node2));
        elm._dp1.projection = projEdge.node1;
        elm._dp1.idxIntPnt = 0;
        elm._dp2.projection = projEdge.node2;
        elm._dp2.idxIntPnt = projEdge.points.length - 1;
        elm._dp1.idxEdge = elm._dp2.idxEdge = idxProjEdge;
        if (v1.angleTo(v2) > v2.angleTo(v1.clone().multiplyScalar(-1))) {
            var tmp = elm._dp1;
            elm._dp1 = elm._dp2;
            elm._dp2 = tmp;
        }

        this._graph.push(elm);
    }

    //
    //  find correspondence to original design
    //
    for (var idx = 0; idx < this._graph.length; idx++) {
        var elm = this._graph[idx];
        var dps = [elm._dp1, elm._dp2];
        var posNodes = [elm._node1, elm._node2];
        var projNodes = [elm._projNode1, elm._projNode2];
        var neighbors = [elm._neighbors1, elm._neighbors2];

        for (var k = 0; k < dps.length; k++) {
            for (var i = designOriginal.length - 1; i >= 0 && dps[k].elm == undefined; i--) {
                var edge = designOriginal[i];
                var points = edge.points;
                var thickness = edge.thickness;
                for (var j = points.length - 1; j >= 0; j--) {
                    // NOTE: set it to 4x to make aggressive connection to original
                    if (XAC.getDist(posNodes[k], points[j]) < thickness[j] * 4) {
                        dps[k].type = 0; // original
                        dps[k].elm = edge
                        dps[k].idxIntPnt = j;
                        dps[k].idxElm = i;
                        dps[k].isIndependent = true;
                        break;
                    }
                } // for the poitns on each edge
            } // for each edge
        } // for each dependency
    }

    //
    // find inter-correspondence within new design
    //
    for (var idx = 0; idx < this._graph.length; idx++) {
        var elm = this._graph[idx];
        var dps = [elm._dp1, elm._dp2];
        var nodes = [elm._node1, elm._node2];
        var neighbors = [elm._neighbors1, elm._neighbors2];
        var indnum = this._independentNumber(elm);

        // find independent neighbor to correspond to
        for (var j = 0; j < dps.length; j++) {
            if (dps[j].isIndependent != true) {
                for (var k = 0; k < neighbors[j].length; k++) {
                    var idxNeighbor = neighbors[j][k].idxElm;
                    var idxIntPnt = neighbors[j][k].idxIntPnt;
                    var elmNeighbor = this._graph[idxNeighbor];
                    if (indnum < this._independentNumber(elmNeighbor)) {
                        dps[j].type = 1; // new design
                        dps[j].elm = elmNeighbor;
                        dps[j].idxElm = idxNeighbor;
                        dps[j].idxIntPnt = idxIntPnt;
                        dps[j].dp = elmNeighbor._neighbors1.indexOf(idx) > 0 ? elmNeighbor._dp1 :
                            elmNeighbor._dp2; // neighbor's dependency
                        break;
                    }
                }

                // if find no depend-upons, depend upon itself
                if (dps[j].elm == undefined) {
                    dps[j].type = 1;
                    dps[j].elm = elm;
                    dps[j].idxElm = idx;
                    dps[j].isIndependent = true;
                }
            } // looking for neighbor to depend on
        } // each node (2 in total)
    } // each graph elm

    //
    //  compute projection
    //
    for (var idx = 0; idx < this._graph.length; idx++) {
        var elm = this._graph[idx];

        // edge has zero end on original deisgn
        if (elm._dp1.type != 0 && elm._dp2.type != 0) {
            // do nothing
        }
        // edge has both ends on original deisgn
        else if (elm._dp1.type == 0 && elm._dp2.type == 0) {
            this._projectTwoEnds(designOriginal, elm._dp1, elm._dp2);
            elm._dp1.isIndependent = true;
            elm._dp2.isIndependent = true;
        }
        // edge has one end on original deisgn
        else {
            var dp1 = elm._dp1.type == 0 ? elm._dp1 : elm._dp2; // on original design
            var dp2 = dp1 == elm._dp1 ? elm._dp2 : elm._dp1; // off original design

            // if snapping to nodes, all connected edges in this case will converge to one point
            if (this.SNAPTONODES) {
                var dp = dp2;
                for (; dp.isIndependent != true; dp = dp.dp) {}
                this._projectOneEnd(designOriginal, dp1, dp.idxEdge, dp.idxIntPnt, elm._id == -1);
            }
            // otherwise they will converge to each other's projection on original
            else {
                var nodeToProj = elm._dp1.type == 0 ? elm._node2 : elm._node1;
                var projInfo = this._project(designOriginal, nodeToProj, false);
                this._projectOneEnd(designOriginal, dp1, projInfo.idxEdge, projInfo.idxIntPnt, elm._id ==
                    -1);
                if (dp2.isIndependent == true) dp2.projection = projInfo.proj;
            }
        }
    }
}

//
//  get the all the edges that a given point intersects
//      * return 1st found if oneHit set to true
//
FORTE.Interpolation.prototype._getIntersectingEdge = function(pos, edges, oneHit) {
    var intEdgesInfo = [];
    for (var i = edges.length - 1; i >= 0; i--) {
        var edge = edges[i];
        var points = edge.points;
        var thickness = edge.thickness;

        var idxIntPnt = undefined;
        // snap to two ends, thus using a larger threshold
        if (XAC.getDist(pos, edge.node1) < thickness[0] * 4) {
            idxIntPnt = 0;
        } else if (XAC.getDist(pos, edge.node2) < thickness[0] * 4) {
            idxIntPnt = points.length - 1;
        } else {
            for (var j = points.length - 1; j >= 0; j--) {
                if (XAC.getDist(pos, points[j]) < thickness[j] * 2) {
                    idxIntPnt = j;
                    break;
                }
            }
        }

        if (idxIntPnt != undefined) {
            var edgeInfo = {
                idxEdge: i,
                idxIntPnt: idxIntPnt
            };
            if (oneHit == true) {
                return edgeInfo;
            }
            intEdgesInfo.push(edgeInfo);
        }
    }
    return intEdgesInfo;
};

//
//  project a point (node) on to a design
//      * visualize the projection if showLine set to true
//
FORTE.Interpolation.prototype._project = function(design, node, showLine) {
    var minDist = Number.MAX_VALUE;
    var projection = undefined;
    var idxProjEdge = -1;
    var idxIntPnt = -1;
    for (var i = 0; i < design.length; i++) {
        for (var j = 0; j < design[i].points.length; j++) {
            var dist = XAC.getDist(node, design[i].points[j]);
            if (dist < minDist) {
                minDist = dist;
                projection = design[i].points[j];
                idxIntPnt = j;
                idxProjEdge = i;
            }
        }
    }

    if (showLine == true) addALine(FORTE.canvasScene, new THREE.Vector3().fromArray(node), new THREE.Vector3()
        .fromArray(projection), 0xff0000);
    return {
        idxEdge: idxProjEdge,
        proj: projection,
        idxIntPnt: idxIntPnt
    };
};

//
//  find a path from the ith edge to the jth edge on the original design
//  NOTE: doesn't handle cyclic cases
//
FORTE.Interpolation.prototype._find = function(i, j, k) {
    if (i == j) {
        return [];
    }

    var nbgrs = this._neighborsOriginal[i][k];
    // bfs: see if in the neighbor
    for (var h = 0; h < nbgrs.length; h++) {
        if (nbgrs[h] == j) return [i];
    }

    // if not go to neighbor's neighbors
    for (var h = 0; h < nbgrs.length; h++) {
        var kk = this._neighborsOriginal[nbgrs[h]][0].indexOf(i) >= 0 ? 1 : 0;
        var path = this._find(nbgrs[h], j, kk);
        if (path != undefined) {
            return [i].concat(path);
        }
    }

    return undefined;
};

//
//  return points an a path starting from the idxElm1 edge at the idxIntPnt1-th point ...
//  to the idxElm2 edge at the idxIntPnt2-th point
//
FORTE.Interpolation.prototype._getPointsOnPath = function(design, idxElm1, idxElm2, idxIntPnt1, idxIntPnt2) {
    // make sure a connectivity graph is built for original design
    // NOTE: this step should not be needed when actually deployed
    if (this._neighborsOriginal == undefined) {
        this._neighborsOriginal = XAC.initMDArray([design.length, 2], undefined);
        for (var i = 0; i < design.length; i++) {
            var nodes = [design[i].node1, design[i].node2];
            for (var j = 0; j < nodes.length; j++) {
                this._neighborsOriginal[i][j] = [];
                var edgesInfo = this._getIntersectingEdge(nodes[j], design);
                for (var k = 0; k < edgesInfo.length; k++) {
                    if (edgesInfo[k].idxEdge != i) {
                        this._neighborsOriginal[i][j].push(edgesInfo[k].idxEdge);
                    }
                }
            }
        }
    }

    var path1 = this._find(idxElm1, idxElm2, 0);
    if (path1 == undefined) { // try finding backwards
        path1 = this._find(idxElm2, idxElm1, 0);
        if (path1 != undefined) path1.reverse();
    }

    var path2 = this._find(idxElm1, idxElm2, 1);
    if (path2 == undefined) {
        path2 = this._find(idxElm2, idxElm1, 1);
        if (path2 != undefined) path2.reverse();
    }

    if (path1 != undefined && path2 != undefined) {
        path = path2.length < path1.length ? path2 : path1;
    } else if (path1 != undefined || path2 != undefined) {
        path = path1 || path2;
    } else {
        err('disconnected components');
    }

    if (path[0] != idxElm1) path.unshift(idxElm1);
    if (idxElm1 != idxElm2) path.push(idxElm2);

    var pointsOnPath = [];
    for (var i = 0; i < path.length; i++) {
        var idx = path[i];
        var edge = design[idx];
        var start, end;
        if (i == 0) {
            start = idxIntPnt1;
            if (path.length > 1) {
                end = this._neighborsOriginal[idx][0].indexOf(path[i + 1]) >= 0 ? 0 :
                    edge.points.length - 1;
            } else {
                end = idxIntPnt2;
            }
        } else if (i == path.length - 1) {
            end = idxIntPnt2;
            start = this._neighborsOriginal[idx][0].indexOf(path[i - 1]) >= 0 ? 0 :
                edge.points.length - 1;
        } else {
            var lastPoint = pointsOnPath.slice(-1)[0];
            if (XAC.getDist(lastPoint, edge.points[0]) <
                XAC.getDist(lastPoint, edge.points.slice(-1)[0])) {
                start = 0;
                end = edge.points.length - 1;
            } else {
                start = edge.points.length - 1;
                end = 0;
            }

        }

        var sign = end >= start ? 1 : -1;
        for (var j = start; sign * j <= sign * end; j += sign) {
            pointsOnPath.push(edge.points[j]);
        }
    }

    return pointsOnPath;
}

//
//  project elms that have one end on the original design
//
FORTE.Interpolation.prototype._projectOneEnd = function(design, dp, idxElm, idxIntPnt, showPath) {
    dp.isIndependent = true;
    dp.path = this._getPointsOnPath(design, dp.idxElm, idxElm, dp.idxIntPnt, idxIntPnt).reverse();
}

//
//  project elms that have two ends on the original design
//
FORTE.Interpolation.prototype._projectTwoEnds = function(design, dp1, dp2) {
    pointsOnPath = this._getPointsOnPath(design, dp1.idxElm, dp2.idxElm, dp1.idxIntPnt, dp2.idxIntPnt);

    var lenPath = 0;
    for (var i = 0; i < pointsOnPath.length; i++) {
        var lastPoint = pointsOnPath[i - 1];
        lenPath += lastPoint == undefined ? 0 : XAC.getDist(pointsOnPath[i], lastPoint);
    }

    // divide the path by mid point
    var lenHalf = 0;
    var idxHalf = -1;
    for (var i = 0; i < pointsOnPath.length; i++) {
        var lastPoint = pointsOnPath[i - 1];
        dLen = lastPoint == undefined ? 0 : XAC.getDist(pointsOnPath[i], lastPoint);
        if (lenHalf <= lenPath / 2 && lenHalf + dLen >= lenPath / 2) {
            idxHalf = i;
            break;
        }
        lenHalf += dLen;
    }

    dp1.path = pointsOnPath.slice(0, idxHalf).reverse();
    dp2.path = pointsOnPath.slice(idxHalf);
}

//
//  compute independent number - number of ends (dps) that are independent
//
FORTE.Interpolation.prototype._independentNumber = function(elm) {
    var num = 0;
    if (elm._dp1.isIndependent) num++;
    if (elm._dp2.isIndependent) num++;
    return num;
}

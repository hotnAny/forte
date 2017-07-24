// ......................................................................................................
//
//  routines to help with the interactive layers
//
//  by xiangchen@acm.org, v0.1, 06/2017
//
// ......................................................................................................

//
//  changing the resolution of the canavs
//
FORTE.changeResolution = function () {
    var width = parseInt($(tbWidth).val());
    var height = parseInt($(tbHeight).val());
    log('canvas size: ' + width + ' x ' + height);
    if (!isNaN(width) && !isNaN(height)) {
        for (layer of FORTE.layers) {
            layer.setResolution(width, height);
        }
    }
    FORTE.design = new FORTE.Design(width, height);
    FORTE.width = width;
    FORTE.height = height;

    for (layer of FORTE.layers) {
        layer._strokeRadius = FORTE.width / 96 | 0;
    }

    // special treatments
    FORTE.loadLayer._context.lineWidth = 8;
    FORTE.loadLayer._context.lineJoin = 'round';
    FORTE.loadLayer._context.strokeStyle = FORTE.loadLayer._context.fillStyle;

    // FORTE.lessMaterialLayer._strokeRadius = 1;
}

//
//  switch to different layers (design, emptiness, load, boundary, etc.)
//  -   set idx to -1 to set all layers equally to disabled state
//
FORTE.switchLayer = function (idx) {
    // for (layer of FORTE.layers) layer.disable(idx >= 0 ? 0.25 : 0);
    for (layer of FORTE.layers) layer.disable(idx < 0 ? 0 : 1);

    if (!isNaN(idx) && idx >= 0) {
        FORTE.layer = FORTE.layers[idx];
        FORTE.layer.enable();
        FORTE.toggleLayerZindex(idx);
    }
}

//
//  pop one layer to the top
//
FORTE.toggleLayerZindex = function (idxTop) {
    for (var i = 0; i < FORTE.layers.length; i++) {
        var zindex = i == idxTop ? FORTE.layers.length - 1 : 0;
        FORTE.layers[i]._canvas.css('z-index', zindex);
    }
    // FORTE.eraserLayer._canvas.css('z-index', FORTE.layers.length + 1);
};

//
//  draw an arraw
//
FORTE.drawArrow = function (context, fromx, fromy, tox, toy) {
    // log([fromx, fromy, tox, toy])
    var headlen = context.lineWidth * 4; // length of head in pixels
    log(context.lineWidth)
    var angle = Math.atan2(toy - fromy, tox - fromx);
    var theta = Math.PI / 6;
    context.beginPath();
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle - theta), toy - headlen * Math.sin(angle - theta));
    // context.lineTo(tox, toy);
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle + theta), toy - headlen * Math.sin(angle + theta));

    context.stroke();
    context.closePath();
    return [fromx, fromy, tox, toy];
};

//
//  distribute loads along the specified path (points)
//
FORTE.distribute = function (points, vector, midPoint, normalizeFactor) {
    var distrVectors = [];

    // fit the load points on an arc
    var ctr;
    try {
        var circleInfo = XAC.fitCircle(points);
        ctr = new THREE.Vector3(circleInfo.x0, circleInfo.y0, 0);
        // FORTE.loadLayer._context.rect(ctr.x * FORTE.loadLayer._cellSize, ctr.y * FORTE.loadLayer._cellSize,
        //     FORTE.loadLayer._cellSize, FORTE.loadLayer._cellSize);
        // FORTE.loadLayer._context.fill();
    } catch (e) {
        console.error(e);
        ctr = new THREE.Vector3();
        for (p of points) ctr.add(p);
        ctr.divideScalar(Math.max(points.length, 1));
    }

    // distribute the loads cocentrically
    var umid = midPoint.clone().sub(ctr).normalize();
    var len = vector.length() / points.length;
    for (var i = 0; i < points.length; i++) {
        var varr;
        var point = new THREE.Vector3(points[i].x, points[i].y, 0);
        if (circleInfo.r > FORTE.loadLayer._context.lineWidth * 2) {
            var u = point.clone().sub(ctr).normalize();
            var angle = umid.angleTo(u);
            var axis = umid.clone().cross(u).normalize();

            varr = vector.clone().applyAxisAngle(axis, angle).divideScalar(points.length)
                .divideScalar(normalizeFactor).toArray().trim(2);

        } else {
            varr = vector.clone().divideScalar(points.length)
                .divideScalar(normalizeFactor).toArray().trim(2);
        }

        varr[2] *= -1;
        distrVectors.push(varr);

        // [debug] do NOT remove - to show the load direction at each point
        // point.x *= FORTE.loadLayer._cellSize;
        // point.y *= FORTE.loadLayer._cellSize;
        // FORTE.loadLayer._context.lineWidth = 1;
        // FORTE.drawArrow(FORTE.loadLayer._context,
        //     point.x, point.y, point.x + varr[0] * 50, point.y + varr[1] * 50);
        // FORTE.loadLayer._context.lineWidth = 8;
    }

    // log(distrVectors)

    return distrVectors;
}

//
//  special customization for the load layer (for specifying load)
//
FORTE.customizeLoadLayer = function () {
    // interaction on the load layer
    FORTE.loadLayer.specifyingLoad = false;
    FORTE.loadLayer._loadInputs = [];

    FORTE.loadLayer._canvas.mousedown(function (e) {
        if (this._toErase) return;
        // if (this.__centerLoadPoint == undefined) return;
        if (this.specifyingLoad) {
            // compute distributed record load information
            this._context.strokeStyle = this.__loadValueLayer._context.strokeStyle;
            this._context.lineWidth = this.__loadValueLayer._context.lineWidth;
            this._context.lineJoin = this.__loadValueLayer._context.lineJoin;
            var canvasOffset = this.__loadValueLayer._canvas.offset();
            var arrow = FORTE.drawArrow(this._context,
                this.__centerLoadPoint.x * this._cellSize, this.__centerLoadPoint.y * this._cellSize,
                e.clientX - canvasOffset.left, e.clientY - canvasOffset.top);
            this.__loadValueLayer.clear();
            this.__loadValueLayer._canvas.remove();
            this._arrows.push(arrow);

            var vector = new THREE.Vector3(
                e.clientX - canvasOffset.left - this.__centerLoadPoint.x * this._cellSize,
                e.clientY - canvasOffset.top - this.__centerLoadPoint.y * this._cellSize, 0);
            var midPoint = new THREE.Vector3(this.__centerLoadPoint.x, this.__centerLoadPoint.y, 0);

            var arrStrokePoints = [];
            for (p of this.__strokePoints) {
                arrStrokePoints.push([p.x, p.y]);
            }
            FORTE.design.loadPoints.push(arrStrokePoints);
            FORTE.design.loadValues.push(FORTE.distribute(this.__strokePoints, vector, midPoint, 1));

            this._enabled = true;
        } else {
            this._rawMouseEvents = [];
        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mousemove(function (e) {
        if (this._toErase) return;
        // if (this.__centerLoadPoint == undefined) return;
        if (this.specifyingLoad) {
            // draw or update an arrow between center point and current mouse
            this.__loadValueLayer.clear();
            var canvasOffset = this.__loadValueLayer._canvas.offset();
            FORTE.drawArrow(this.__loadValueLayer._context,
                this.__centerLoadPoint.x * this._cellSize, this.__centerLoadPoint.y * this._cellSize, e.clientX - canvasOffset.left, e.clientY - canvasOffset.top);
        } else {
            if (this._isDown) this._rawMouseEvents.push(e);
        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mouseup(function (e) {
        if (this._toErase) {
            var toRemoveLoadPoints = [];
            var toRemoveLoadValues = [];
            for (var i = 0; i < FORTE.design.loadPoints.length; i++) {
                var points = FORTE.design.loadPoints[i];
                for (p of points) {
                    var done = false;
                    for (q of this._strokePoints) {
                        if (p[0] == q.x && p[1] == q.y) {
                            toRemoveLoadPoints.push(points);
                            toRemoveLoadValues.push(FORTE.design.loadValues[i]);

                            FORTE.loadLayer.eraseArrow(i);

                            for (e of FORTE.loadLayer._loadInputs[i]) FORTE.loadLayer._doDraw(e, true);

                            done = true;
                            break;
                        }
                    } // each stroke point
                    if (done) break;
                } // each load point
            } // each load point array

            for (points of toRemoveLoadPoints) FORTE.design.loadPoints.remove(points);
            for (values of toRemoveLoadValues) FORTE.design.loadValues.remove(values);
        } else {
            this.specifyingLoad = !this.specifyingLoad;
            if (this.specifyingLoad) {
                // find the center point of last stroke
                var footprint = 0;
                for (var i = 1; i < this._strokePoints.length; i++) {
                    var p0 = this._strokePoints[i - 1];
                    var p1 = this._strokePoints[i];
                    footprint += Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
                }

                var footprint2 = 0;
                for (var i = 1; i < this._strokePoints.length; i++) {
                    var p0 = this._strokePoints[i - 1];
                    var p1 = this._strokePoints[i];
                    footprint2 += Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
                    if (footprint2 > footprint / 2) {
                        this.__centerLoadPoint = {
                            x: (p0.x + p1.x) / 2,
                            y: (p0.y + p1.y) / 2
                        };
                        break;
                    }
                }

                if (this.__centerLoadPoint == undefined) this.__centerLoadPoint = this._strokePoints[0];

                if (this.__centerLoadPoint == undefined) return;

                this._arrows = this._arrows || [];
                this.__loadValueLayer = new FORTE.GridCanvas(this._parent, this._gridWidth, this._gridHeight);
                this.__loadValueLayer._context = this.__loadValueLayer._canvas[0].getContext('2d');
                this.__loadValueLayer._context.strokeStyle = this._context.fillStyle;
                this.__loadValueLayer._context.lineWidth = this._context.lineWidth;
                this.__loadValueLayer._context.lineJoin = this._context.lineJoin;

                this.__strokePoints = this._strokePoints.clone();

                // this.__strokePoints = [this._strokePoints[0]];

                this._enabled = false;
            }
            if (this._rawMouseEvents != undefined) this._loadInputs.push(this._rawMouseEvents);
        }
    }.bind(FORTE.loadLayer));

    // 
    //
    //
    FORTE.loadLayer.normalizedArrows = function () {
        var w = this._canvas[0].width;
        var h = this._canvas[0].height;
        var arrows = [];
        for (arrow of this._arrows)
            arrows.push([arrow[0] / w, arrow[1] / h, arrow[2] / w, arrow[3] / h]);
        return arrows;
    }

    //
    //
    //
    FORTE.loadLayer.eraseArrow = function (idx) {
        var arrow = this._arrows[idx];
        var inflationRatio = 1.25;
        this._context.lineWidth *= inflationRatio;
        var globalCompositeOperation = this._context.globalCompositeOperation;
        this._context.globalCompositeOperation = "destination-out";
        this._context.strokeStyle = "rgba(0,0,0,1)";
        FORTE.drawArrow(this._context, arrow[0], arrow[1], arrow[2], arrow[3]);
        this._context.strokeStyle = this._context.fillStyle;
        this._context.globalCompositeOperation = globalCompositeOperation;
    }
}

// //
// //
// //
// FORTE.customizeEraserLayer = function () {
//     FORTE.eraserLayer._defaultAlpha = 1;

//     FORTE.eraserLayer._canvas.css('opacity', this._defaultAlpha);

//     FORTE.eraserLayer._canvas.mousedown(function (e) {
//         for (layer of FORTE.layers) {
//             if (layer != this) {
//                 layer.enable();
//                 // layer._context.fillStyle = this._context.fillStyle;
//                 layer.drawDown(e, true);
//             }
//         }
//     }.bind(FORTE.eraserLayer));

//     FORTE.eraserLayer._canvas.mousemove(function (e) {
//         for (layer of FORTE.layers)
//             if (layer != this) layer.drawMove(e, true);
//     }.bind(FORTE.eraserLayer));

//     FORTE.eraserLayer._canvas.mouseup(function (e) {
//         if (!this._enabled) return;
//         this._isDown = false;

//         if (FORTE.focusedDesignLayer != undefined) {
//             this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
//             FORTE.design.lastOutputFile = FORTE.focusedDesignLayer.lastOutputFile;
//             FORTE.startOptimization(FORTE.GETVARIATION)
//         } else {
//             var toRemoveLoadPoints = [];
//             var toRemoveLoadValues = [];
//             for (var i = 0; i < FORTE.design.loadPoints.length; i++) {
//                 var points = FORTE.design.loadPoints[i];
//                 for (p of points) {
//                     var done = false;
//                     for (q of this._strokePoints) {
//                         if (p[0] == q.x && p[1] == q.y) {
//                             toRemoveLoadPoints.push(points);
//                             toRemoveLoadValues.push(FORTE.design.loadValues[i]);
//                             FORTE.loadLayer.eraseArrow(i);

//                             for (e of FORTE.loadLayer._loadInputs[i]) FORTE.loadLayer._doDraw(e, true);

//                             done = true;
//                             break;
//                         }
//                     } // each stroke point
//                     if (done) break;
//                 } // each load point
//             } // each load point array

//             for (points of toRemoveLoadPoints) FORTE.design.loadPoints.remove(points);
//             for (values of toRemoveLoadValues) FORTE.design.loadValues.remove(values);

//             for (layer of FORTE.layers) {
//                 if (layer != this) {
//                     // layer.eraseInLayer(this._strokePoints);
//                     layer.drawUp(e);
//                     layer._context.fillStyle = layer._strokeColor;
//                 }
//             }
//         }
//     }.bind(FORTE.eraserLayer));
// }
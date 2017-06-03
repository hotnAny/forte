// ......................................................................................................
//
//  routines to help with the interactive layers
//
//  by xiangchen@acm.org, v0.0, 06/2017
//
// ......................................................................................................

//
//  changing the resolution of the canavs
//
FORTE.changeResolution = function () {
    var width = parseInt($(tbWidth).val());
    var height = parseInt($(tbHeight).val());
    if (!isNaN(width) && !isNaN(height)) {
        for (layer of FORTE.layers) {
            layer.setResolution(width, height);
        }
    }
    FORTE.design = new FORTE.Design(width, height);
    FORTE.width = width;
    FORTE.height = height;

    for (layer of FORTE.layers) {
        layer._strokeRadius = FORTE.width / 128;
    }

    // special treatments
    FORTE.emptinessLayer._strokeRadius *= 3;
    FORTE.loadLayer._context.lineWidth = 8;
    FORTE.loadLayer._context.lineJoin = 'round';
    FORTE.loadLayer._context.strokeStyle = FORTE.loadLayer._context.fillStyle;
    FORTE.loadLayer._context.lineWidth = 8;
    FORTE.loadLayer._context.lineJoin = 'round';
}

//
//  switch to different layers (design, emptiness, load, boundary, etc.)
//
FORTE.switchLayer = function (e) {
    for (layer of FORTE.layers) layer._canvas.css('opacity', 1);

    var idx = parseInt($(e.target).val());
    if (!isNaN(idx)) {
        FORTE.layer = FORTE.layers[idx];
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
};

//
//  draw an arraw
//
FORTE.drawArrow = function (context, fromx, fromy, tox, toy) {
    // log([fromx, fromy, tox, toy])
    var headlen = context.lineWidth * 4; // length of head in pixels
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
FORTE.distriute = function (points, vector, midPoint, normalizeFactor) {
    var distrVectors = [];

    // fit the load points on an arc
    var circleInfo = XAC.fitCircle(points);
    var ctr = new THREE.Vector3(circleInfo.x0, circleInfo.y0, 0);

    // [debug] to show the load direction at each point
    // var offset = FORTE.loadLayer._canvas.offset();
    // var cellSize = FORTE.loadLayer._cellSize;
    // FORTE.loadLayer._context.lineWidth = 1;
    // FORTE.loadLayer._context.rect(ctr.x - 5, ctr.y - 5, 10, 10);
    // FORTE.loadLayer._context.fill()

    // distribute the loads cocentrically
    var umid = midPoint.clone().sub(ctr).normalize();
    var len = vector.length() / points.length;
    for (var i = 0; i < points.length; i++) {
        var point = new THREE.Vector3(points[i].x, points[i].y, 0);
        var u = point.clone().sub(ctr).normalize();
        var angle = umid.angleTo(u);
        var axis = umid.clone().cross(u).normalize();

        var varr = vector.clone().applyAxisAngle(axis, angle).divideScalar(
            points.length).divideScalar(normalizeFactor).toArray().trim(2);
        distrVectors.push(varr);

        // [debug] to show the load direction at each point
        // point.x *= cellSize;
        // point.y *= cellSize;
        // FORTE.drawArrow(FORTE.loadLayer._context,
        //     point.x, point.y, point.x + varr[0] * 30, point.y + varr[1] * 30);
    }

    return distrVectors;
}

FORTE.customizeLoadLayer = function () {
    // interaction on the load layer
    FORTE.loadLayer.specifyingLoad = false;
    FORTE.loadLayer._canvas.mousedown(function (e) {
        if (this.specifyingLoad) {
            // log('done')
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
            FORTE.design.loadValues.push(FORTE.distriute(this.__strokePoints, vector, midPoint, 1));

        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mousemove(function (e) {
        if (this.specifyingLoad) {
            // draw or update an arrow between center point and current mouse
            this.__loadValueLayer.clear();
            var canvasOffset = this.__loadValueLayer._canvas.offset();
            FORTE.drawArrow(this.__loadValueLayer._context,
                this.__centerLoadPoint.x * this._cellSize, this.__centerLoadPoint.y * this._cellSize, e.clientX - canvasOffset.left, e.clientY - canvasOffset.top);
        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mouseup(function (e) {
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

            this._arrows = this._arrows || [];
            this.__loadValueLayer = new FORTE.GridCanvas(this._parent, this._gridWidth, this._gridHeight);
            this.__loadValueLayer._context = this.__loadValueLayer._canvas[0].getContext('2d');
            this.__loadValueLayer._context.strokeStyle = this._context.fillStyle;
            this.__loadValueLayer._context.lineWidth = this._context.lineWidth;
            this.__loadValueLayer._context.lineJoin = this._context.lineJoin;
            this.__strokePoints = this._strokePoints.clone();
        }
    }.bind(FORTE.loadLayer));
}

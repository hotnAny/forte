// ......................................................................................................
//
//  a demo/test bed for accelerated 2d topology optimization
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.width = 128;
FORTE.height = 96;

$(document).ready(function () {
    // set font size
    $('*').each(function () {
        $(this).css('font-size', 'small');
    });

    FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);

    // resolution
    var tbWidth = $('<input id="tbWidth" type="text" value="' + FORTE.width + '" size="3">');
    var tbHeight = $('<input id="tbHeight" type="text" value="' + FORTE.height + '" size="3">');
    $('#tdResolution').append(tbWidth);
    $('#tdResolution').append('&nbsp;×&nbsp;');
    $('#tdResolution').append(tbHeight);
    tbWidth.keydown(FORTE.changeResolution);
    tbHeight.keydown(FORTE.changeResolution);

    // slider
    FORTE.sldrMaterial = XAC.makeSlider('sldrMaterial', 'material', 0, 100, 50, $('#tdMaterial'));

    // brushes for design, load and boundary
    FORTE.nameBrushButtons = 'brushButtons';
    XAC.makeRadioButtons('brushButtons', ['design', 'empty', 'load', 'boundary'], [0, 1, 2, 3], $('#tdBrushes'), 0);
    $('[name="' + FORTE.nameBrushButtons + '"]').on("change", FORTE.switchLayer);

    // clear
    FORTE.btnClear = $('<div>clear</div>');
    FORTE.btnClear.button();
    FORTE.btnClear.click(function (e) {
        for (layer of FORTE.layers) layer.clear();
        FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);
    });
    $('#tdClear').append(FORTE.btnClear);

    // run
    FORTE.btnRun = $('<div>run</div>');
    FORTE.btnRun.button();
    FORTE.btnRun.click(function (e) {
        FORTE.design.designPoints = FORTE.designLayer.package();
        FORTE.design.emptyPoints = FORTE.emptyLayer.package();
        FORTE.design.boundaryPoints = FORTE.boundaryLayer.package();
        var data = JSON.stringify(FORTE.design.getData());
        XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', ['forte', 'material'], [data, 1.5]);
        // log(data)

    });
    $('#tdRun').append(FORTE.btnRun);

    // layers
    FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#000000');
    FORTE.designLayer._strokeRadius = 1;
    FORTE.emptyLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#fffa90');
    FORTE.emptyLayer._strokeRadius = 3;
    FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#cc0000');
    FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#007fff');
    $('#tdCanvas').css('background', '#eeeeee');

    FORTE.layers = [FORTE.designLayer, FORTE.emptyLayer, FORTE.loadLayer, FORTE.boundaryLayer];
    FORTE.layer = FORTE.designLayer;
    FORTE.toggleLayerZindex(0);

    FORTE.customizeLoadLayer();

    FORTE.GridCanvas.prototype.package = function () {
        var points = [];
        for (var j = 0; j < this._gridHeight; j++) {
            for (var i = 0; i < this._gridWidth; i++) {
                if (this._bitmap[j][i] == 1) {
                    points.push([i, j]);
                }
            }
        }
        return points;
    }

    FORTE.xmlhttp = new XMLHttpRequest();
    FORTE.xmlhttp.timeout = 1e9;
    FORTE.xmlhttp.onreadystatechange = function () {
        if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
            log(FORTE.xmlhttp.responseText);
            // var name = XAC.getParameterByName('name', FORTE.xmlhttp.responseText);
            // FORTE.thisQuery = XAC.getParameterByName('query', FORTE.xmlhttp.responseText);
            // var dimVoxel = XAC.getParameterByName('dim_voxel', FORTE.xmlhttp.responseText);
            // var xmin = XAC.getParameterByName('xmin', FORTE.xmlhttp.responseText);
            // var ymin = XAC.getParameterByName('ymin', FORTE.xmlhttp.responseText);
            // var dir = XAC.getParameterByName('dir', FORTE.xmlhttp.responseText);
            // var outpath = XAC.getParameterByName('outpath', FORTE.xmlhttp.responseText);
            // var daeLoader = new THREE.ColladaLoader();
            // daeLoader.load(outpath, function colladaReady(collada) {
            // 	var object = collada.scene.children[0];
            // 	log(object)
            // 	// log(player)
            // 	// skin = collada.skins[0];
            // 	FORTE.canvasScene.add(object);
            // });
        }
    }
});

//
//  changing the resolution of the canavs
//
FORTE.changeResolution = function (e) {
    if (e.keyCode == XAC.ENTER) {
        var width = parseInt($(tbWidth).val());
        var height = parseInt($(tbHeight).val());
        if (!isNaN(width) && !isNaN(height)) {
            for (layer of FORTE.layers) {
                layer.setResolution(width, height);
            }
        }
        FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);
    }
}

//
//  switch to different layers (design, empty, load, boundary, etc.)
//
FORTE.switchLayer = function (e) {
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
            FORTE.drawArrow(this._context,
                this.__centerLoadPoint.x * this._cellSize, this.__centerLoadPoint.y * this._cellSize,
                e.clientX - canvasOffset.left, e.clientY - canvasOffset.top);
            this.__loadValueLayer.clear();
            this.__loadValueLayer._canvas.remove();

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

            this.__loadValueLayer = new FORTE.GridCanvas(this._parent, this._gridWidth, this._gridHeight);
            this.__loadValueLayer._context = this.__loadValueLayer._canvas[0].getContext('2d');
            this.__loadValueLayer._context.strokeStyle = this._context.fillStyle;
            this.__loadValueLayer._context.lineWidth = this._strokeRadius * 8;
            this.__loadValueLayer._context.lineJoin = 'round';
            this.__strokePoints = this._strokePoints.clone();
        }
    }.bind(FORTE.loadLayer));
}
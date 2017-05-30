// ......................................................................................................
//
//  a demo/test bed for accelerated 2d topology optimization
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.width = 256;
FORTE.height = 192;
FORTE.FETCHINTERVAL = 100;
FORTE.MAXITERATIONS = 50;
FORTE.MINMATERIALRATIO = 0.5;
FORTE.MAXMATERIALRATIO = 2.5;
FORTE.GIVEUPTHRESHOLD = 10;

$(document).ready(function () {
    time();

    // set font size
    $('*').each(function () {
        $(this).css('font-size', 'small');
    });

    //
    // enable drag and drop
    //
    XAC.enableDragDrop(function (files) {
        for (var i = files.length - 1; i >= 0; i--) {
            var reader = new FileReader();
            reader.onload = (function (e) {
                for (layer of FORTE.layers) layer._canvas.css('opacity', 1);

                var dataObject = JSON.parse(e.target.result);
                $(tbWidth).val(dataObject.width);
                $(tbHeight).val(dataObject.height);
                FORTE.changeResolution();
                FORTE.btnClear.trigger('click');
                FORTE.designLayer.drawFromBitmap(dataObject.designBitmap, 0, 0, 0);
                FORTE.emptinessLayer.drawFromBitmap(dataObject.emptinessBitmap, 0, 0, 0);
                FORTE.loadLayer.drawFromBitmap(dataObject.loadBitmap, 0, 0, 0);
                for (arrow of dataObject.loadArrows) {
                    FORTE.drawArrow(FORTE.loadLayer._context, arrow[0], arrow[1], arrow[2], arrow[3]);
                }
                FORTE.design.loadPoints = dataObject.loadPoints;
                FORTE.design.loadValues = dataObject.loadValues;
                FORTE.boundaryLayer.drawFromBitmap(dataObject.boundaryBitmap, 0, 0, 0);
                // FORTE.toggleLayerZindex(FORTE.layers.indexOf(FORTE.loadLayer));
            });
            reader.readAsBinaryString(files[i]);
        }
    });

    //
    // resolution
    //
    var tbWidth = $('<input id="tbWidth" type="text" value="' + FORTE.width + '" size="3">');
    var tbHeight = $('<input id="tbHeight" type="text" value="' + FORTE.height + '" size="3">');
    $('#tdResolution').append(tbWidth);
    $('#tdResolution').append('&nbsp;×&nbsp;');
    $('#tdResolution').append(tbHeight);
    tbWidth.keydown(FORTE.keydown);
    tbHeight.keydown(FORTE.keydown);

    //
    // material amount slider
    //
    FORTE.materialRatio = 1.5;
    var minSlider = 0,
        maxSlider = 100;
    var ratio = (FORTE.materialRatio - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
    var valueSlider = minSlider * (1 - ratio) + maxSlider * ratio;
    $('#tdMaterial').width('192px');
    FORTE.sldrMaterial = XAC.makeSlider('sldrMaterial', 'material',
        0, 100, valueSlider, $('#tdMaterial'));
    FORTE.sldrMaterial.slider({
        change: function (event, ui) {
            var max = $(event.target).slider("option", "max");
            var min = $(event.target).slider("option", "min");
            var value = (ui.value - min) * 1.0 / (max - min);
            FORTE.materialRatio = FORTE.MINMATERIALRATIO * (1 - value) + FORTE.MAXMATERIALRATIO * value;
        }
    })

    //
    // brushes for design, load and boundary
    //
    FORTE.nameBrushButtons = 'brushButtons';
    XAC.makeRadioButtons('brushButtons', ['design', 'emptiness', 'load', 'boundary'], [0, 1, 2, 3], $('#tdBrushes'), 0);
    $('[name="' + FORTE.nameBrushButtons + '"]').on("change", FORTE.switchLayer);

    // clear
    FORTE.btnClear = $('<div>clear</div>');
    FORTE.btnClear.button();
    FORTE.btnClear.click(function (e) {
        for (layer of FORTE.layers) layer.clear();
        FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);
    });
    $('#tdClear').append(FORTE.btnClear);

    //
    // run
    //
    FORTE.btnRun = $('<div>run</div>');
    FORTE.btnRun.button();
    FORTE.btnRun.click(function (e) {
        var keys = Object.keys(FORTE.htOptimizedLayers);
        for (key of keys) {
            var layer = FORTE.htOptimizedLayers[key];
            if (layer != undefined) layer._canvas.remove();
        }

        for (layer of FORTE.layers) {
            // if (layer != FORTE.designLayer) {
            layer._canvas.css('opacity', 0); //remove();
            // }
        }

        FORTE.design.designPoints = FORTE.designLayer.package();
        FORTE.design.emptyPoints = FORTE.emptinessLayer.package();
        FORTE.design.boundaryPoints = FORTE.boundaryLayer.package();
        var data = JSON.stringify(FORTE.design.getData());
        if (data != undefined) {
            FORTE.trial = 'forte_' + Date.now();
            XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', ['trial', 'forte', 'material'], [FORTE.trial, data, FORTE.materialRatio]);
            FORTE.state = 'start';
            time();
            FORTE.fetchData();
        }

    });
    $('#tdRun').append(FORTE.btnRun);

    //
    // save
    //
    FORTE.btnSave = $('<div>save</div>');
    FORTE.btnSave.button();
    FORTE.btnSave.click(function (e) {
        var dataObject = {
            width: FORTE.width,
            height: FORTE.height,
            designBitmap: FORTE.designLayer._bitmap,
            emptinessBitmap: FORTE.emptinessLayer._bitmap,
            loadBitmap: FORTE.loadLayer._bitmap,
            loadArrows: FORTE.loadLayer._arrows,
            loadPoints: FORTE.design.loadPoints,
            loadValues: FORTE.design.loadValues,
            boundaryBitmap: FORTE.boundaryLayer._bitmap
        }
        var data = JSON.stringify(dataObject);
        if (data != undefined) {
            var blob = new Blob([data], {
                type: 'text/plain'
            });
            saveAs(blob, 'design.forte');
        }
    });
    $('#tdSave').append(FORTE.btnSave);

    //
    // layers of editing
    //
    FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#000000');
    FORTE.emptinessLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#fffa90');
    FORTE.emptinessLayer._strokeRadius = 3;
    FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#cc0000');
    FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#007fff');
    $('#tdCanvas').css('background', '#eeeeee');

    FORTE.layers = [FORTE.designLayer, FORTE.emptinessLayer, FORTE.loadLayer, FORTE.boundaryLayer];
    FORTE.layer = FORTE.designLayer;
    FORTE.toggleLayerZindex(0);

    FORTE.customizeLoadLayer();
    FORTE.changeResolution();

    FORTE.xmlhttp = new XMLHttpRequest();
    FORTE.xmlhttp.timeout = 1e9;
    FORTE.xmlhttp.onreadystatechange = function () {
        if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
            log(FORTE.xmlhttp.responseText);
            var outDir = XAC.getParameterByName('outdir', FORTE.xmlhttp.responseText);
            if (outDir != null && outDir != undefined) {
                FORTE.outDir = outDir;
                log('[log] server output directory: ' + FORTE.outDir);
            }
        }
    }

    //
    // layers of optimization
    //
    FORTE.htOptimizedLayers = {};
    var marginPanel = -5;
    var parentOffset = $('#tdCanvas').offset();
    FORTE.optimizedPanel = $('<div align="right"></div>');
    FORTE.optimizedPanel.width(96);
    FORTE.optimizedPanel.css('position', 'absolute');
    var parentWidth = $('#tdCanvas').width();
    FORTE.optimizedPanel.css('left', parentOffset.left + parentWidth -
        marginPanel - FORTE.optimizedPanel.width());
    FORTE.optimizedPanel.css('top', parentOffset.top + marginPanel);
    FORTE.optimizedPanel.css('z-index', 100);
    $('#tdCanvas').append(FORTE.optimizedPanel);

    FORTE.optimizedLayerList = $('<ul></ul>');
    FORTE.optimizedLayerList.tagit({
        onTagClicked: function (event, ui) {
            FORTE.showOptimizedLayer(ui.tag, ui.tagLabel);
        },
        beforeTagRemoved: function (event, ui) {
            var layer = FORTE.htOptimizedLayers[ui.tagLabel];
            if (layer != undefined) layer._canvas.remove();
            FORTE.htOptimizedLayers[ui.tagLabel] = undefined;
            // FORTE.showOptimizedLayer(ui.tag, ui.tagLabel);
        }
    });
    FORTE.optimizedPanel.append(FORTE.optimizedLayerList);

    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);
    time('ready.')
});

//
//  global keydown handler
//
FORTE.keydown = function (e) {
    if (e.keyCode == XAC.ENTER) {
        FORTE.changeResolution();
    }
}

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

//
//  routine to fetch data from matlab output
//
FORTE.fetchData = function () {
    if (FORTE.state == 'start') {
        FORTE.itrCounter = 0;
        log('[log] data fetching started');
        FORTE.state = 'ongoing';
        setTimeout(FORTE.fetchData, FORTE.FETCHINTERVAL);
        FORTE.optimizedLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#888888');
        FORTE.optimizedLayer._strokeRadius = FORTE.designLayer._strokeRadius;
        FORTE.fetchInterval = FORTE.FETCHINTERVAL;
        FORTE.failureCounter = 0;
    } else if (FORTE.state == 'finished') {
        log('[log] data fetching stopped');
        return;
    } else {
        if (FORTE.outDir == undefined || FORTE.outDir == null)
            console.error('output directory unavailable');
        var baseDir = FORTE.outDir + '/' + FORTE.trial;
        XAC.readTextFile(baseDir + (FORTE.itrCounter + 1) + '.out', function (text) {
            var bitmap = FORTE.getBitmap(text);
            if (FORTE.itrCounter < FORTE.MAXITERATIONS) {
                FORTE.optimizedLayer.drawFromBitmap(bitmap, FORTE.design.bbox.xmin, FORTE.design.bbox.ymin, 0.5);
                time('[log] redrew for itr# ' + (FORTE.itrCounter + 1) + ' after failing ' + FORTE.failureCounter + ' time(s)');
                FORTE.itrCounter += 1;
                setTimeout(FORTE.fetchData, FORTE.FETCHINTERVAL);
            }

            FORTE.fetchInterval = FORTE.FETCHINTERVAL;
            FORTE.failureCounter = 0;
        }, function () {
            if (FORTE.itrCounter == 0) {
                setTimeout(FORTE.fetchData, FORTE.fetchInterval);
                FORTE.fetchInterval *= 1.1;
            } else {
                FORTE.failureCounter++;
                if (FORTE.failureCounter > FORTE.GIVEUPTHRESHOLD) {
                    FORTE.state = 'finished';
                    var numLayers = Object.keys(FORTE.htOptimizedLayers).length;
                    var label = 'layer ' + (numLayers + 1);
                    FORTE.htOptimizedLayers[label] = FORTE.optimizedLayer;
                    var tag = FORTE.optimizedLayerList.tagit('createTag', label);
                    FORTE.showOptimizedLayer(tag, label);
                } else {
                    setTimeout(FORTE.fetchData, FORTE.FETCHINTERVAL);
                }
            }
        });
    }
}

//
//  parse matlab output text as a bitmap
//
FORTE.getBitmap = function (text) {
    var rowsep = '\n';
    var colsep = ',';

    var rows = text.split(rowsep);

    var nrows = rows.length;
    var ncols = nrows > 0 ? rows[0].split(colsep).length : 0;

    if (nrows <= 0 || ncols <= 0) return;

    bitmap = [];
    for (row of rows) {
        var arrRowStr = row.split(colsep);
        var arrRow = [];
        for (str of arrRowStr) arrRow.push(parseFloat(str));
        bitmap.push(arrRow);
    }

    return bitmap;
}

//
//  only show selected optimized layer, given its label
//
FORTE.showOptimizedLayer = function (tag, label) {
    if (FORTE.selectedTag != undefined) {
        $(FORTE.selectedTag).removeClass('ui-state-highlight');
    }

    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) {
        var layer = FORTE.htOptimizedLayers[key];
        if (layer != undefined) layer._canvas.remove();
    }

    if (FORTE.selectedTag != undefined && FORTE.selectedTag[0] == tag[0]) {
        FORTE.selectedTag = undefined;
        return;
    }

    var layer = FORTE.htOptimizedLayers[label];
    if (layer != undefined) {
        layer._parent.append(layer._canvas);
        FORTE.selectedTag = tag;
        $(FORTE.selectedTag).addClass('ui-state-highlight');
    } else {
        FORTE.selectedTag = undefined;
    }
}
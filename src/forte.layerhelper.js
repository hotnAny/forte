// ......................................................................................................
//
//  routines to customize different interactive layers
//
//  by xiangchen@acm.org, v1.0, 10/2017
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

    // roughly adjust stroke radius based on resolution
    for (layer of FORTE.layers)
        layer._strokeRadius = FORTE.width / 128 | 0;
    FORTE.emptyLayer._strokeRadius /= 2;

    // special treatments
    FORTE.loadLayer._context.lineWidth = 8;
    FORTE.loadLayer._context.lineJoin = 'round';
    FORTE.loadLayer._context.strokeStyle = FORTE.loadLayer._context.fillStyle;

    // updating thickness measurements
    // FORTE.maxElmsThickness = Math.min(FORTE.width, FORTE.height) / 2;
    // FORTE.minElmsThickness = (FORTE.maxElmsThickness * 0.05) | 0;
    // var valueSlider = FORTE._getSliderValue(0.25);
    // FORTE.sldrThickness.slider('value', valueSlider);
}

//
//  switch to different layers (design, emptiness, load, boundary, etc.)
//  -   set idx to -1 to set all layers equally to disabled state
//
FORTE.switchLayer = function (idx) {
    // disbale all brush layers, but only hide them (opacity=0)
    // when idx < 0, which means opitmization starts
    for (layer of FORTE.layers) layer.disable(idx < 0 ? 0 : 1);

    // enable the selected layer
    if (!isNaN(idx) && idx >= 0) {
        FORTE.layer = FORTE.layers[idx];
        FORTE.layer.enable();
        $('.info-label').show();
    } else {
        $('.info-label').hide();
    }

    // adjust z-index accordingly
    FORTE.toggleLayerZindex(idx);

    // high/show labels for design layer
    if (FORTE.layer == FORTE.designLayer || idx < 0) {
        var opacityLabel = FORTE.designLayer._enabled ? FORTE.OPACITYDIMLABEL : 0;
        if (FORTE.designLayer._lbBoundingWidth != undefined) {
            FORTE.designLayer._lbBoundingWidth.css('opacity', opacityLabel);
            FORTE.designLayer._lbBoundingHeight.css('opacity', opacityLabel);
        }
    }
}

//
//  pop one layer (given its index in FORTE.layers) to the top
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
    var headlen = context.lineWidth * 4; // length of head in pixels
    var angle = Math.atan2(toy - fromy, tox - fromx);
    var theta = Math.PI / 6;
    context.beginPath();
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle - theta), toy - headlen * Math.sin(angle - theta));
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

        // flip y as screen coordinates is upside down
        varr[2] *= -1;
        distrVectors.push(varr);

        // [debug] do ** NOT ** remove - to show the load direction at each point
        // point.x *= FORTE.loadLayer._cellSize;
        // point.y *= FORTE.loadLayer._cellSize;
        // FORTE.loadLayer._context.lineWidth = 1;
        // FORTE.drawArrow(FORTE.loadLayer._context,
        //     point.x, point.y, point.x + varr[0] * 10, point.y + varr[1] * 10);
        // FORTE.loadLayer._context.lineWidth = 8;
    }

    return distrVectors;
}

//
//  special customization for the load layer (mainly for specifying/removing load)
//
FORTE.customizeLoadLayer = function () {
    // interaction on the load layer
    FORTE.loadLayer.isSpecifyingLoad = false;
    FORTE.loadLayer._loadInputs = [];
    FORTE.loadLayer.getSqDist = function (p, q) {
        return Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2);
    };
    
    // mouse down
    FORTE.loadLayer._canvas.mousedown(function (e) {
        if (this.isSpecifyingLoad) {
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
        }
    }.bind(FORTE.loadLayer));

    // mouse move
    FORTE.loadLayer._canvas.mousemove(function (e) {
        if (this.isSpecifyingLoad) {
            // draw or update an arrow between center point and current mouse
            this.__loadValueLayer.clear();
            var canvasOffset = this.__loadValueLayer._canvas.offset();
            var a = FORTE.drawArrow(this.__loadValueLayer._context,
                this.__centerLoadPoint.x * this._cellSize, this.__centerLoadPoint.y * this._cellSize, e.clientX - canvasOffset.left, e.clientY - canvasOffset.top);
            var lengthArrow = Math.sqrt(Math.pow(a[0] - a[2], 2) + Math.pow(a[1] - a[3], 2));
            var forceValue = FORTE.mapToWeight(lengthArrow);
            // FORTE.notify(XAC.trim(forceValue, 0) + ' kg', false);
            this._loadLabel.html(XAC.trim(forceValue, 0) + ' kg');
            this.labelOffset = 16;
            this._loadLabel.css('left', e.clientX + this.labelOffset);
            this._loadLabel.css('top', e.clientY + this.labelOffset);
        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mouseup(function (e) {
        //
        // erase the whole case of loading
        //
        if (this._toErase) {
            var toRemoveLoadPoints = [];
            var toRemoveLoadValues = [];
            var margin = 2;
            for (var i = 0; i < FORTE.design.loadPoints.length; i++) {
                var points = FORTE.design.loadPoints[i];
                for (p of points) {
                    var done = false;
                    for (q of this._strokePoints) {
                        if (p[0] == q.x && p[1] == q.y) {
                            toRemoveLoadPoints.push(points);
                            toRemoveLoadValues.push(FORTE.design.loadValues[i]);

                            FORTE.loadLayer.eraseArrow(i);

                            FORTE.loadLabels[i].remove();
                            FORTE.loadLabels.remove(FORTE.loadLabels[i]);

                            done = true;
                            break;
                        }
                    } // each stroke point
                    if (done) break;
                } // each load point
            } // each load point array

            for (points of toRemoveLoadPoints) FORTE.design.loadPoints.remove(points);
            for (values of toRemoveLoadValues) FORTE.design.loadValues.remove(values);
        }
        //
        // start or finish specifying load value / direction
        //
        else {
            this.isSpecifyingLoad = !this.isSpecifyingLoad;
            if (this.isSpecifyingLoad) {
                // create label to show load value
                this._loadLabel = $('<label class="ui-widget info-label" style="position:absolute;"></label>');
                this._loadLabel.css('opacity', FORTE.SHOWINFOLABELS ? FORTE.OPACITYDIMLABEL : 0);
                this._loadLabel.css('color', this._strokeColor);
                FORTE.loadLabels = FORTE.loadLabels || [];
                FORTE.loadLabels.push(this._loadLabel);
                $(document.body).append(this._loadLabel);

                // resample
                var minSqDistApart = Math.pow(this._strokeRadius * this._cellSize, 2);
                var points = [];
                for (var i = 0; i < this._strokePoints.length; i++) {
                    var p = this._strokePoints[i];
                    if (points.length == 0 || this.getSqDist(p, points.last()) > minSqDistApart)
                        points.push(p);
                }
                this._strokePoints = points;

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

                // detect abnormal cases
                if (this.__centerLoadPoint == undefined) this.__centerLoadPoint = this._strokePoints[0];
                if (this.__centerLoadPoint == undefined) return;

                this._arrows = this._arrows || [];
                this.__loadValueLayer = new FORTE.GridCanvas(this._parent, this._gridWidth, this._gridHeight);
                this.__loadValueLayer._context = this.__loadValueLayer._canvas[0].getContext('2d');
                this.__loadValueLayer._context.strokeStyle = this._context.fillStyle;
                this.__loadValueLayer._context.lineWidth = this._context.lineWidth;
                this.__loadValueLayer._context.lineJoin = this._context.lineJoin;

                this.__strokePoints = this._strokePoints.clone();

                this._enabled = false;
            }
        }
    }.bind(FORTE.loadLayer));

    // 
    //  normalize the magnitude of arrows (indicating loads)
    //
    FORTE.loadLayer.getNormalizedArrows = function () {
        var w = this._canvas[0].width;
        var h = this._canvas[0].height;
        var arrows = [];
        for (arrow of this._arrows)
            arrows.push([arrow[0] / w, arrow[1] / h, arrow[2] / w, arrow[3] / h]);
        return arrows;
    }

    //
    //  'erase' an arrow by drawing over it
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
        this._context.lineWidth /= inflationRatio;
        this._arrows.removeAt(idx);
    }
}

//
//  [suggestive editing] 
//  add eraser to an optimized layer to interactively add/remove material
//
FORTE.addEditingLayer = function (layer) {
    layer._canvas.mousedown(function (e) {
        if (!this._enabled) return;
        // temporarily changing properties of the layer to show eraser
        this._bitmapBackup = [];
        for (row of this._bitmap) this._bitmapBackup.push(row.clone());
        switch (FORTE.editMode) {
            case FORTE.DRAW:
                break;
            case FORTE.ERASE:
                this._context.fillStyle = FORTE.COLORERASER;
                this._strokeRadius *= 1.5;
                break;
        }
        this.drawDown(e);
    }.bind(layer));

    layer._canvas.mousemove(function (e) {
        if (!this._enabled) return;
        this.drawMove(e);
    }.bind(layer));

    layer._canvas.mouseup(function (e) {
        if (!this._enabled) return;
        this.drawUp(e);
        // recover the origiinal proerties
        switch (FORTE.editMode) {
            case FORTE.DRAW:
                FORTE.design.favPoints = FORTE.design.favPoints || [];
                for (p of this._strokePoints) FORTE.design.favPoints.push([p.x, p.y]);
                break;
            case FORTE.ERASE:
                this._strokeRadius /= 1.5;
                FORTE.design.slimPoints = FORTE.design.slimPoints || [];
                for (p of this._strokePoints) FORTE.design.slimPoints.push([p.x, p.y]);
                break;
        }

        FORTE.design.lastOutputFile = FORTE.focusedDesignLayer.lastOutputFile;
        log(FORTE.design.lastOutputFile);
        $('#btnOptCtrl').trigger('click');

        // don't let the editing affect this previous result
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        this._context.fillStyle = this._strokeColor;
        this._bitmap = this._bitmapBackup;
        this.forceRedraw(FORTE.toShowStress ? this._heatmap : undefined);

        FORTE.design.slimPoints = [];
        FORTE.design.favPoints = [];

    }.bind(layer));
}

//
//  add a layer that displays the dimensional info
//  - this implementation contains bugs and is obseletely discontinued
//
FORTE.addInfoLayer = function (layer) {
    layer._boundingMargin = 16; //px
    
    // update dimension info given a changed length per pixel
    layer.updateDimInfo = function () {
        var offset = this._parent.offset();
        // displaying actual width
        this._actualWidth = (this._max.x - this._min.x) * FORTE.lengthPerPixel;
        FORTE._lbBoundingWidth.html(XAC.trim(this._actualWidth, 0) + ' mm');
        FORTE._lbBoundingWidth.css('left', offset.left + (this._min.x + this._max.x) / 2);
        FORTE._lbBoundingWidth.css('top', offset.top + this._canvas[0].height - this._boundingMargin * 3);

        // displaying actual height
        this._actualHeight = (this._max.y - this._min.y) * FORTE.lengthPerPixel;
        FORTE._lbBoundingHeight.html(XAC.trim(this._actualHeight, 0) + ' mm');
        FORTE._lbBoundingHeight.css('left', offset.left + this._boundingMargin * 2);
        FORTE._lbBoundingHeight.css('top', offset.top + (this._min.y + this._max.y) / 2);
    }

    layer._canvas.mousemove(function (e) {
        if (!this._enabled) return;
        if (!this._isDown || e.button == XAC.RIGHTMOUSE) return;

        var originalStyle = this._context.strokeStyle;
        var opacityInfoLabel = FORTE.SHOWINFOLABELS ? FORTE.OPACITYDIMLABEL : 0;
        this._context.strokeStyle = 'rgba(0, 0, 0, ' + opacityInfoLabel + ')';
        this._context.lineWidth = 1;
        if (this._minPrev != undefined && this._maxPrev != undefined) {
            this._context.clearRect(this._minPrev.x - this._context.lineWidth,
                this._canvas[0].height - this._boundingMargin - this._context.lineWidth,
                this._maxPrev.x - this._minPrev.x + this._context.lineWidth * 2,
                this._context.lineWidth * 2);

            this._context.clearRect(this._boundingMargin - this._context.lineWidth,
                this._minPrev.y - this._context.lineWidth,
                this._context.lineWidth * 2,
                this._maxPrev.y - this._minPrev.y + this._context.lineWidth * 2);
        }

        this._context.beginPath();
        this._context.moveTo(this._min.x, this._canvas[0].height - this._boundingMargin);
        this._context.lineTo(this._max.x, this._canvas[0].height - this._boundingMargin);
        this._context.moveTo(this._boundingMargin, this._min.y);
        this._context.lineTo(this._boundingMargin, this._max.y);

        this._context.stroke();
        this._context.closePath();
        this._context.strokeStyle = originalStyle;

        this.updateDimInfo();

        this._minPrev = {
            x: this._min.x,
            y: this._min.y
        };
        this._maxPrev = {
            x: this._max.x,
            y: this._max.y
        };
    }.bind(layer));

    // augment the original clear function to clear the info labels
    layer.clear = function () {
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        this._bitmap = XAC.initMDArray([this._gridHeight, this._gridWidth], 0);
        if (FORTE._lbBoundingWidth != undefined) {
            FORTE._lbBoundingWidth.html('');
            FORTE._lbBoundingHeight.html('');
        }
        this._min = undefined;
        this._max = undefined;
    }
}
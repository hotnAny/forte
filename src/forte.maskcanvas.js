// ......................................................................................................
//
//  an inheritance from gridcanvas for drawing mask (rather than sketching)
//
//  by xiangchen@acm.org, v0.0, 07/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.MaskCanvas = function (parent, width, height, strokeColor) {
    FORTE.GridCanvas.call(this, parent, width, height, strokeColor);
    this._canvas.bind('mousewheel', this._update.bind(this));
    this._nregions = 0;
    this._regions = {};
    this._strokeRadius = 1;

    //
    //  override to package mask data
    //
    this.package = function () {
        var info = {
            points: [],
            values: []
        };

        var imgData = this._context.getImageData(0, 0, this._canvas[0].width, this._canvas[0].height);

        for (var idx = 0; idx < imgData.data.length; idx += 4) {
            if (imgData.data[idx] > 0) {
                var x = (idx / 4) % this._canvas[0].width;
                var y = (idx / 4 - x) / this._canvas[0].width;
                var i = (x / this._cellSize) | 0;
                var j = (y / this._cellSize) | 0;
                info.points.push([i, j]);
                info.values.push(1 - imgData.data[idx + 3] / 255.0);
            }
        }

        return info;
    };

    //
    //  override clearing method
    //
    this.clear = function () {
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        this._regions = {};
    };
};

FORTE.MaskCanvas.prototype = Object.create(FORTE.GridCanvas.prototype);

//
//  mousedown for drawing
//
FORTE.MaskCanvas.prototype.drawDown = function (e) {
    if (!this._enabled || e.button == XAC.RIGHTMOUSE) return;
    this._isDown = true;

    this._strokePoints = [];
    this._markPoints = [];
    this._hitRegionOnDown = e.originalEvent.region;
    this._doDraw(e, this._toErase);
    var canvasOffset = this._canvas.offset();
    var x = e.clientX - canvasOffset.left;
    var y = e.clientY - canvasOffset.top;
    this._markPoints.push({
        x: x,
        y: y
    });
};

//
//  mousemove for drawing
//
FORTE.MaskCanvas.prototype.drawMove = function (e) {
    this._hitRegion = e.originalEvent.region;

    if (!this._enabled) return;
    if (!this._isDown || e.button == XAC.RIGHTMOUSE) return;

    var canvasOffset = this._canvas.offset();
    var x = e.clientX - canvasOffset.left;
    var y = e.clientY - canvasOffset.top;
    this._markPoints.push({
        x: x,
        y: y
    });
    this._doDraw(e, this._toErase);
};

//
//  mouseup for drawing
//
FORTE.MaskCanvas.prototype.drawUp = function (e) {
    if (!this._enabled) return;
    this._isDown = false;

    if (this._toErase) {
        var keys = Object.keys(this._regions);
        for (key of keys) {
            if (key == this._hitRegionOnDown) this._regions[key] = undefined;
        }
    } else {
        var idRegion = this._id + '_' + this._nregions++;
        this._context.addHitRegion({
            id: idRegion
        });
        this._regions[idRegion] = {
            points: this._markPoints.clone(),
            alpha: this._context.globalAlpha
        };
    }

    this._update();
};

//
//  adjust the alpha of a selected region
//
FORTE.MaskCanvas.prototype._update = function (e) {
    var regionInfo = this._regions[this._hitRegion];
    if (regionInfo != undefined || e == undefined) {
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        var keys = Object.keys(this._regions);
        for (key of keys) {
            regionInfo = this._regions[key];
            if (regionInfo == undefined) continue;
            var originalAlpha = this._context.globalAlpha;
            if (key == this._hitRegion && e != undefined) {
                var alphaDelta = e.originalEvent.wheelDelta / 3600.0;
                regionInfo.alpha += alphaDelta;
                regionInfo.alpha = Math.min(1, Math.max(0, regionInfo.alpha));
            }
            this._context.globalAlpha = regionInfo.alpha;

            this._context.beginPath();
            for (var i = 0; i < regionInfo.points.length; i++) {
                var p = regionInfo.points[i];
                if (i == 0) this._context.moveTo(p.x, p.y);
                else this._context.lineTo(p.x, p.y);
            }
            this._context.closePath();
            this._context.fill();
            this._context.globalAlpha = originalAlpha;
            this._context.addHitRegion({
                id: key
            });
        }
    }
}
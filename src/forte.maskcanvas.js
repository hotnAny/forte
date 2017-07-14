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
    this._canvas.bind('mousewheel', this._adjustAlpha.bind(this));
    this._nregions = 0;
    this._regions = {};
    this._context.globalAlpha = 0.5;

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
};

FORTE.MaskCanvas.prototype = Object.create(FORTE.GridCanvas.prototype);

//
//  mousedown for drawing
//
FORTE.MaskCanvas.prototype.drawDown = function (e) {
    if (!this._enabled || e.button == XAC.RIGHTMOUSE) return;
    this._isDown = true;

    this._strokePoints = [];
    this._context.beginPath();
    var canvasOffset = this._canvas.offset();
    var x = e.clientX - canvasOffset.left;
    var y = e.clientY - canvasOffset.top;
    this._strokePoints.push({
        x: x,
        y: y
    });
    this._context.moveTo(x, y);
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
    this._strokePoints.push({
        x: x,
        y: y
    });
    this._context.lineTo(x, y);
    this._context.fill();
};

//
//  mouseup for drawing
//
FORTE.MaskCanvas.prototype.drawUp = function (e) {
    if (!this._enabled) return;
    this._isDown = false;

    this._context.closePath();
    this._context.fill();
    var idRegion = this._id + '_' + this._nregions++;
    this._context.addHitRegion({
        id: idRegion
    });
    this._regions[idRegion] = {
        points: this._strokePoints.clone(),
        alpha: this._context.globalAlpha
    };

    this.package();
};

//
//  adjust the alpha of a selected region
//
FORTE.GridCanvas.prototype._adjustAlpha = function (e) {
    var regionInfo = this._regions[this._hitRegion];
    if (regionInfo != undefined) {
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        var keys = Object.keys(this._regions);
        for (key of keys) {
            regionInfo = this._regions[key];
            var originalAlpha = this._context.globalAlpha;
            if (key == this._hitRegion) {
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
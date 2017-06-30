var FORTE = FORTE || {};

FORTE.MaskCanvas = function (parent, width, height) {
    FORTE.GridCanvas.call(this, parent, width, height, FORTE.COLORMASKSTROKE);
    this._canvas.css('background-color', FORTE.COLORMASKBACKGROUND);
    this._canvas.bind('mousewheel', this._adjustAlpha.bind(this));
    this._nregions = 0;
    this._regions = {};
    this._context.globalAlpha = 0.5;
};

FORTE.MaskCanvas.prototype = Object.create(FORTE.GridCanvas.prototype);

//
//  mousedown for drawing
//
FORTE.MaskCanvas.prototype.drawDown = function (e) {
    if (!this._enabled || e.button == XAC.RIGHTMOUSE) return;
    this._isDown = true;

    this._strokePoints = [];
    // this._doDraw(e);
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

    // this._doDraw(e);

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
};

//
//
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
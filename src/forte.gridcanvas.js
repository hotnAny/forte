// ......................................................................................................
//
//  a grid-like canvas for drawing topology optimization compatible design
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.GridCanvas = function (parent, width, height, strokeColor, bgColor) {
    this._parent = parent;

    this._strokeRadius = 1;
    this._strokeColor = strokeColor == undefined ? '#000000' : strokeColor;

    this._canvas = $('<canvas id="canvas"></canvas>');
    if (bgColor != undefined) {
        this._canvas.css('background', bgColor);
    }
    var parentOffset = this._parent.offset();
    this._canvas.css('position', 'absolute');
    this._canvas.css('left', parentOffset.left);
    this._canvas.css('top', parentOffset.top);
    this._canvas[0].width = this._parent.width();
    this.setResolution(width, height);
    this._parent.append(this._canvas);

    this._canvas.mousedown(this.drawDown.bind(this));
    this._canvas.mousemove(this.drawMove.bind(this));
    this._canvas.mouseup(this.drawUp.bind(this));

};

// max canvas height to stay within a normal screen
FORTE.GridCanvas.MAXCANVASHEIGHT = 640;

FORTE.GridCanvas.prototype = {
    constructor: FORTE.GridCanvas
};

//
// set the resolution of the grid
//
FORTE.GridCanvas.prototype.setResolution = function (w, h) {
    this._canvas[0].width = this._parent.width();
    this._canvas[0].height = Math.min(FORTE.GridCanvas.MAXCANVASHEIGHT,
        this._canvas[0].width * h / w);
    this._canvas[0].width = this._canvas[0].height * w / h;
    this._cellSize = this._canvas[0].width / w;
    this._bitmap = XAC.initMDArray([h, w], 0);
    this._gridWidth = w;
    this._gridHeight = h;

    this._parent.css('height', this._canvas[0].height + 'px');
};

//
//  mousedown for drawing
//
FORTE.GridCanvas.prototype.drawDown = function (e) {
    this._isDown = true;
    this._context = this._canvas[0].getContext('2d');
    this._context.fillStyle = this._strokeColor;
    this._context.beginPath();
};

//
//  mousemove for drawing
//
FORTE.GridCanvas.prototype.drawMove = function (e) {
    if (!this._isDown) return;
    var canvasOffset = this._canvas.offset();
    var xcenter = ((e.clientX - canvasOffset.left) / this._cellSize) | 0;
    var ycenter = ((e.clientY - canvasOffset.top) / this._cellSize) | 0;

    var strokeRadiusSquare = Math.pow(this._strokeRadius, 2);
    for (var dx = -this._strokeRadius; dx <= this._strokeRadius; dx += 1) {
        for (var dy = -this._strokeRadius; dy <= this._strokeRadius; dy += 1) {
            var x = Math.max(0, Math.min(this._gridWidth - 1, xcenter + dx));
            var y = Math.max(0, Math.min(this._gridHeight - 1, ycenter + dy));
            // [note] removed because of speed
            // if (Math.pow(x * this._cellSize + canvasOffset.left - e.clientX, 2) +
            //     Math.pow(y * this._cellSize + canvasOffset.top - e.clientY, 2) <= strokeRadiusSquare) {
            if(this._bitmap[y][x] != 1) {
                this._context.rect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._context.fill();
                this._bitmap[y][x] = 1;
            }
        }
    }
};

//
//  mouseup for drawing
//
FORTE.GridCanvas.prototype.drawUp = function (e) {
    this._isDown = false;
    this._context.closePath();
};

//
//  clear the canvas
//
FORTE.GridCanvas.prototype.clear = function () {
    if (this._context != undefined) {
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        this._bitmap = XAC.initMDArray([this._gridWidth, this._gridHeight], 0);
    }
}
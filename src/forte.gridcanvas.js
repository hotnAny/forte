// ......................................................................................................
//
//  a grid-like canvas for drawing topology optimization compatible design
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.GridCanvas = function (parent, width, height, strokeColor) {
    this._id = (100 + Math.random() * 900 | 0).toString();

    this._parent = parent;

    this._strokeRadius = 1;
    this._strokeColor = strokeColor == undefined ? '#000000' : strokeColor;

    this._canvas = $('<canvas id="canvas"></canvas>');
    var parentOffset = this._parent.offset();
    this._canvas.css('position', 'absolute');
    this._canvas.css('left', parentOffset.left);
    this._canvas.css('top', parentOffset.top);
    this._canvas[0].width = this._parent.width();
    this.setResolution(width, height);
    this._parent.append(this._canvas);

    this._context = this._canvas[0].getContext('2d');
    this._context.fillStyle = this._strokeColor;

    this._canvas.mousedown(this.drawDown.bind(this));
    this._canvas.mousemove(this.drawMove.bind(this));
    this._canvas.mouseup(this.drawUp.bind(this));

    this._enabled = true;

};

// max canvas height to stay within a normal screen
FORTE.GridCanvas.MAXCANVASHEIGHT = 640;

FORTE.GridCanvas.prototype = {
    constructor: FORTE.GridCanvas
};

FORTE.GridCanvas.prototype.remove = function () {
    this._canvas.remove();
    this._removed = true;
}

FORTE.GridCanvas.prototype.revive = function () {
    if (!this._removed) return;
    this._parent.append(this._canvas);
    this._canvas.mousedown(this.drawDown.bind(this));
    this._canvas.mousemove(this.drawMove.bind(this));
    this._canvas.mouseup(this.drawUp.bind(this));
    this._removed = false;
}

FORTE.GridCanvas.prototype.enable = function () {
    this._enabled = true;
    this._canvas.css('opacity', 1);
}

FORTE.GridCanvas.prototype.disable = function (opacity) {
    this._enabled = false;
    this._canvas.css('opacity', opacity);
}

//
// set the resolution of the grid
//
FORTE.GridCanvas.prototype.setResolution = function (w, h) {
    this._canvas[0].width = this._parent.width();
    this._canvas[0].height = this._canvas[0].width * h / w;
    // this._canvas[0].width = this._canvas[0].height * w / h;
    this._cellSize = this._canvas[0].width / w;
    this._bitmap = XAC.initMDArray([h, w], 0);
    this._gridWidth = w;
    this._gridHeight = h;
    this._parent.css('height', this._canvas[0].height + 'px');
    this._context = this._canvas[0].getContext('2d');
    this._context.fillStyle = this._strokeColor;
};

//
//  mousedown for drawing
//
FORTE.GridCanvas.prototype.drawDown = function (e) {
    if (!this._enabled) return;
    this._isDown = true;
    this._context.beginPath();
    this._strokePoints = [];
    this._doDraw(e);
    // var canvasOffset = this._canvas.offset();
    // var xcenter = ((e.clientX - canvasOffset.left) / this._cellSize) | 0;
    // var ycenter = ((e.clientY - canvasOffset.top) / this._cellSize) | 0;
    // this._strokePoints = [{
    //     x: xcenter,
    //     y: ycenter
    // }];
    // this._prevPoint = {
    //     x: 0,
    //     y: 0
    // };
};

//
//  mousemove for drawing
//
FORTE.GridCanvas.prototype.drawMove = function (e) {
    if (!this._enabled) return;
    if (!this._isDown) return;

    this._doDraw(e);
    // this._prevPoint = {
    //     x: xcenter,
    //     y: ycenter
    // };
};

//
//  mouseup for drawing
//
FORTE.GridCanvas.prototype.drawUp = function (e) {
    if (!this._enabled) return;
    this._isDown = false;
    this._context.closePath();
};

FORTE.GridCanvas.prototype._doDraw = function (e) {
    var canvasOffset = this._canvas.offset();
    var xcenter = ((e.clientX - canvasOffset.left) / this._cellSize) | 0;
    var ycenter = ((e.clientY - canvasOffset.top) / this._cellSize) | 0;

    for (var dx = -this._strokeRadius; dx <= this._strokeRadius; dx += 1) {
        for (var dy = -this._strokeRadius; dy <= this._strokeRadius; dy += 1) {
            var x = Math.max(0, Math.min(this._gridWidth - 1, xcenter + dx));
            var y = Math.max(0, Math.min(this._gridHeight - 1, ycenter + dy));
            if (this._bitmap[y][x] != 1) {
                this._context.rect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._context.fill();
                this._bitmap[y][x] = 1;
                this._strokePoints.push({
                    x: x,
                    y: y
                });
            }
        }
    }
}

//
//  clear the canvas
//
FORTE.GridCanvas.prototype.clear = function () {
    if (this._context != undefined) {
        this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
        this._bitmap = XAC.initMDArray([this._gridWidth, this._gridHeight], 0);
    }
}

//
//  draw on the canvas from an input bitmap, using (x0, y0) as the origin
//
FORTE.GridCanvas.prototype.drawFromBitmap = function (bitmap, x0, y0, thres, colorMap) {
    var h = bitmap.length;
    var w = h > 0 ? bitmap[0].length : 0;
    if (h <= 0 || w <= 0) return;
    var originalStyle = this._context.fillStyle;

    for (var j = 0; j < h; j++) {
        for (var i = 0; i < w; i++) {
            var x = x0 + i;
            var y = y0 + j;
            if (bitmap[j][i] > thres && this._bitmap[y][x] <= thres) {
                this._context.beginPath();
                this._context.rect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._context.fill();
                this._context.closePath();
            } else if (bitmap[j][i] <= thres && this._bitmap[y][x] > thres) {
                this._context.clearRect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
            }
            this._bitmap[j + y0][i + x0] = bitmap[j][i];
        }
    }
    this._context.fillStyle = originalStyle;
}

//
//  force to redraw everything
//
FORTE.GridCanvas.prototype.forceRedraw = function (thres, colorMap) {
    var originalStyle = this._context.fillStyle;
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    for (var j = 0; j < this._gridHeight; j++) {
        for (var i = 0; i < this._gridWidth; i++) {
            var x = i,
                y = j;
            if (colorMap != undefined && colorMap[j][i] != undefined) {
                this._context.globalAlpha = Math.pow(this._bitmap[j][i], 3);
                this._context.beginPath();
                this._context.rect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._context.fillStyle = colorMap[j][i];
                this._context.fill();
                this._context.closePath();
            }
        }
    }
    this._context.globalAlpha = 1;
    this._context.fillStyle = originalStyle;
}

//
//  pacakge the drawn bitmap sparsely into an array
//
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
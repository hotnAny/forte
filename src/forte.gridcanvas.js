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

    this._defaultAlpha = 1;
    this._canvas.css('opacity', this._defaultAlpha);
};

// max canvas height to stay within a normal screen
FORTE.GridCanvas.MAXCANVASHEIGHT = 640;

FORTE.GridCanvas.prototype = {
    constructor: FORTE.GridCanvas
};

//
//  enable the canvas and set opacity to 1
//
FORTE.GridCanvas.prototype.enable = function () {
    this._enabled = true;
    this._canvas.css('opacity', this._defaultAlpha);
}

//
//  disable the canvas and set opacity to the given value
//
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
    if (!this._enabled || e.button == XAC.RIGHTMOUSE) return;
    this._isDown = true;

    this._strokePoints = [];
    this._doDraw(e, this._toErase);
};

//
//  mousemove for drawing
//
FORTE.GridCanvas.prototype.drawMove = function (e) {
    if (!this._enabled) return;
    if (!this._isDown || e.button == XAC.RIGHTMOUSE) return;

    this._doDraw(e, this._toErase);
};

//
//  mouseup for drawing
//
FORTE.GridCanvas.prototype.drawUp = function (e) {
    if (!this._enabled) return;
    this._isDown = false;
};

//
//  actually perform the drawing based on a mouse event
//
FORTE.GridCanvas.prototype._doDraw = function (e, toErase) {
    var canvasOffset = this._canvas.offset();
    var xcenter = ((e.clientX - canvasOffset.left) / this._cellSize) | 0;
    var ycenter = ((e.clientY - canvasOffset.top) / this._cellSize) | 0;

    var alphaDescent = 0.5 / this._strokeRadius;
    for (var dx = -this._strokeRadius; dx <= this._strokeRadius; dx += 1) {
        var alphas = [];
        for (var dy = -this._strokeRadius; dy <= this._strokeRadius; dy += 1) {
            var x = Math.max(0, Math.min(this._gridWidth - 1, xcenter + dx));
            var y = Math.max(0, Math.min(this._gridHeight - 1, ycenter + dy));
            this._context.globalAlpha = 1 - (Math.abs(dx) + Math.abs(dy)) * alphaDescent;
            this._context.beginPath();
            if (toErase) {
                this._context.clearRect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._bitmap[y][x] = 0;
            } else {
                this._context.rect(x * this._cellSize, y * this._cellSize,
                    this._cellSize, this._cellSize);
                this._context.fill();
                this._bitmap[y][x] = 1;
            }
            this._strokePoints.push({
                x: x,
                y: y
            });
            this._context.closePath();
        }
    }
    this._context.globalAlpha = 1;
}

//
//  clear the canvas
//
FORTE.GridCanvas.prototype.clear = function () {
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    this._bitmap = XAC.initMDArray([this._gridHeight, this._gridWidth], 0);
}

//
//  draw on the canvas from an input bitmap, using (x0, y0) as the origin
//
FORTE.GridCanvas.prototype.drawFromBitmap = function (bitmap, x0, y0) {
    var h = bitmap.length;
    var w = h > 0 ? bitmap[0].length : 0;
    if (h <= 0 || w <= 0) return;
    var originalStyle = this._context.fillStyle;
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    for (var j = 0; j < h; j++) {
        for (var i = 0; i < w; i++) {
            var x = x0 + i,
                y = y0 + j;
            this._context.globalAlpha = Math.min(1, bitmap[j][i] / FORTE.PSEUDOMAXALPHA);
            this._context.beginPath();
            this._context.rect((x * this._cellSize) | 0, (y * this._cellSize) | 0,
                (this._cellSize + 1) | 0, (this._cellSize + 1) | 0);
            this._context.fill();
            this._context.closePath();
            this._bitmap[y][x] = bitmap[j][i];
        }
    }
    this._context.globalAlpha = 1;
    this._context.fillStyle = originalStyle;
}

//
//  force to redraw everything
//
FORTE.GridCanvas.prototype.forceRedraw = function (colorMap) {
    var originalStyle = this._context.fillStyle;
    this._context.clearRect(0, 0, this._canvas[0].width, this._canvas[0].height);
    for (var j = 0; j < this._gridHeight; j++) {
        for (var i = 0; i < this._gridWidth; i++) {
            this._context.globalAlpha = Math.min(1, this._bitmap[j][i] / FORTE.PSEUDOMAXALPHA);
            this._context.beginPath();
            this._context.rect((i * this._cellSize) | 0, (j * this._cellSize) | 0,
                (this._cellSize + 1) | 0, (this._cellSize + 1) | 0);
            if (colorMap != undefined && colorMap[j][i] != undefined)
                this._context.fillStyle = colorMap[j][i];
            this._context.fill();
            this._context.closePath();
        }
    }
    this._context.globalAlpha = 1;
    this._context.fillStyle = originalStyle;
    this._needsUpdate = false;
}

//
//  pacakge the drawn bitmap sparsely into an array
//
FORTE.GridCanvas.prototype.package = function () {
    var points = [];
    for (var j = 0; j < this._gridHeight; j++) {
        for (var i = 0; i < this._gridWidth; i++) {
            // if (this._bitmap[j][i] == 1) {
            if (this._bitmap[j][i] > FORTE.THRESDENSITY) {
                points.push([i, j]);
            }
        }
    }
    return points;
}

//
//  [obselete]
//  when global ui layout changes, manually update canvas position so it stays with the parent
//
FORTE.GridCanvas.prototype.updateCanvasPosition = function () {
    var parentOffset = this._parent.offset();
    this._canvas.css('position', 'absolute');
    this._canvas.css('left', parentOffset.left);
    this._canvas.css('top', parentOffset.top);
}

//
//
//
// FORTE.GridCanvas.prototype.eraseInLayer = function (points) {
//     for (p of points) {
//         this._bitmap[p.y][p.x] = 0;
//     }
// }
// ......................................................................................................
//
// ......................................................................................................
var FORTE = FORTE || {};

FORTE.GridCanvas = function (parent, w, h) {
    this._parent = parent;
    this._canvas = $('<canvas id="canvas"' +
        'style="background: #eeeeee;"></canvas>');
    this._canvas.css('background', '#eeeeee');
    this._canvas[0].width = this._parent.width();
    this.setResolution(w, h);
    this._parent.append(this._canvas);

    this._canvas.mousedown(this.drawDown.bind(this));
    this._canvas.mousemove(this.drawMove.bind(this));
    this._canvas.mouseup(this.drawUp.bind(this));
};

FORTE.GridCanvas.MAXCANVASHEIGHT = 640;

FORTE.GridCanvas.prototype = {
    constructor: FORTE.GridCanvas
};

FORTE.GridCanvas.prototype.setResolution = function (w, h) {
    this._canvas[0].width = this._parent.width();
    this._canvas[0].height = Math.min(FORTE.GridCanvas.MAXCANVASHEIGHT,
        this._canvas[0].width * h / w);
    this._canvas[0].width = this._canvas[0].height * w / h;
    this._cellSize = this._canvas[0].width / FORTE.width;
};

FORTE.GridCanvas.prototype.drawDown = function (e) {
    this._isDown = true;
    this._context = this._canvas[0].getContext('2d');
    this._context.fillStyle = '#000000';
    this._context.beginPath();
};

FORTE.GridCanvas.prototype.drawMove = function (e) {
    if (!this._isDown) return;
    var canvasOffset = this._canvas.offset();
    var x = ((e.clientX - canvasOffset.left) / this._cellSize) | 0;
    var y = ((e.clientY - canvasOffset.top) / this._cellSize) | 0;
    this._context.rect(x * this._cellSize, y * this._cellSize, this._cellSize, this._cellSize);
    this._context.fill();
};

FORTE.GridCanvas.prototype.drawUp = function (e) {
    this._isDown = false;
    this._context.closePath();
};
// ......................................................................................................
//
// ......................................................................................................
var FORTE = FORTE || {};

FORTE.width = 128;
FORTE.height = 96;
FORTE.MAXCANVASHEIGHT = 640;

$(document).ready(function () {
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
    XAC.makeRadioButtons('brushButtons', ['design', 'load', 'boundary'], $('#tdBrushes'), 0);
   
    // clear
    FORTE.btnClear = $('<div>clear</div>');
    FORTE.btnClear.button();
    FORTE.btnClear.click(function (e) {
        FORTE.context.clearRect(0, 0, FORTE.canvas[0].width, FORTE.canvas[0].height);
    });
    $('#tdClear').append(FORTE.btnClear);

    // run
    FORTE.btnRun = $('<div>run</div>');
    FORTE.btnRun.button();
    $('#tdRun').append(FORTE.btnRun);

    // canvas
    FORTE.canvas = $('<canvas id="canvas"' +
        'style="background: #eeeeee;"></canvas>');
    FORTE.canvas.css('background', '#eeeeee');
    FORTE.canvas[0].width = $('#tdCanvas').width();
    FORTE.canvas[0].height = Math.min(FORTE.MAXCANVASHEIGHT,
        FORTE.canvas[0].width * FORTE.height / FORTE.width);
    FORTE.canvas[0].width = FORTE.canvas[0].height * FORTE.width / FORTE.height;

    $('#tdCanvas').append(FORTE.canvas);
    FORTE.cellSize = FORTE.canvas[0].width / FORTE.width;

    FORTE.canvas.mousedown(FORTE.canvasDown);
    FORTE.canvas.mousemove(FORTE.canvasMove);
    FORTE.canvas.mouseup(FORTE.canvasUp);

});

FORTE.canvasDown = function (e) {
    FORTE.isDown = true;
    FORTE.context = FORTE.canvas[0].getContext('2d');
    FORTE.context.fillStyle = '#000000';
    FORTE.context.beginPath();
};

FORTE.canvasMove = function (e) {
    if (!FORTE.isDown) return;
    var canvasOffset = FORTE.canvas.offset();
    var x = ((e.clientX - canvasOffset.left) / FORTE.cellSize) | 0;
    var y = ((e.clientY - canvasOffset.top) / FORTE.cellSize) | 0;
    FORTE.context.rect(x * FORTE.cellSize, y * FORTE.cellSize, FORTE.cellSize, FORTE.cellSize);
    FORTE.context.fill();
};

FORTE.canvasUp = function (e) {
    FORTE.isDown = false;
    FORTE.context.closePath();
};

FORTE.changeResolution = function (e) {
    if (e.keyCode == XAC.ENTER) {
        var width = parseInt($(tbWidth).val());
        var height = parseInt($(tbHeight).val());
        if (!isNaN(width) && !isNaN(height)) {
            FORTE.width = width;
            FORTE.height = height;
            FORTE.canvas[0].width = $('#tdCanvas').width();
            FORTE.canvas[0].height = Math.min(FORTE.MAXCANVASHEIGHT,
                FORTE.canvas[0].width * FORTE.height / FORTE.width);
            FORTE.canvas[0].width = FORTE.canvas[0].height * FORTE.width / FORTE.height;
            FORTE.cellSize = FORTE.canvas[0].width / FORTE.width;
        }
    }
}
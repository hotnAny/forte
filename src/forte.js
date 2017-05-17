// ......................................................................................................
//
// ......................................................................................................
var FORTE = FORTE || {};

FORTE.width = 128;
FORTE.height = 96;

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
    FORTE.canvas = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height);
});

FORTE.changeResolution = function (e) {
    if (e.keyCode == XAC.ENTER) {
        var width = parseInt($(tbWidth).val());
        var height = parseInt($(tbHeight).val());
        if (!isNaN(width) && !isNaN(height)) {
            FORTE.canvas.setResolution(width, height);
        }
    }
}
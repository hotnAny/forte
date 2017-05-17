// ......................................................................................................
//
//  a demo/test bed for accelerated 2d topology optimization
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.width = 128;
FORTE.height = 96;

$(document).ready(function () {
    // set font size
    $('*').each(function () {
        $(this).css('font-size', 'small');
    });

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
    XAC.makeRadioButtons('brushButtons', ['design', 'empty', 'load', 'boundary'], [0, 1, 2, 3], $('#tdBrushes'), 0);
    $('[name="' + FORTE.nameBrushButtons + '"]').on("change", FORTE.switchLayer);

    // clear
    FORTE.btnClear = $('<div>clear</div>');
    FORTE.btnClear.button();
    FORTE.btnClear.click(function (e) {
        for (layer of FORTE.layers) layer.clear();
    });
    $('#tdClear').append(FORTE.btnClear);

    // run
    FORTE.btnRun = $('<div>run</div>');
    FORTE.btnRun.button();
    $('#tdRun').append(FORTE.btnRun);

    // layers
    FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#000000');
    FORTE.designLayer._strokeRadius = 1;
    FORTE.emptyLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#f1a899');
    FORTE.emptyLayer._strokeRadius = 3;
    FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#fffa90');
    FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#007fff');
    $('#tdCanvas').css('background', '#eeeeee');

    FORTE.layers = [FORTE.designLayer, FORTE.emptyLayer, FORTE.loadLayer, FORTE.boundaryLayer];
    FORTE.layer = FORTE.designLayer;
    FORTE.toggleLayerZindex(0);

    // interaction on the load layer
    FORTE.loadLayer._canvas.mousedown(function () {
        if (this.specifyingLoad) {
            console.log('done')
        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mousemove(function () {
        if (this.specifyingLoad) {
            console.log('specifying load')
        }
    }.bind(FORTE.loadLayer));
    FORTE.loadLayer._canvas.mouseup(function () {
        this.specifyingLoad = !this.specifyingLoad;
    }.bind(FORTE.loadLayer));
});

//
//  changing the resolution of the canavs
//
FORTE.changeResolution = function (e) {
    if (e.keyCode == XAC.ENTER) {
        var width = parseInt($(tbWidth).val());
        var height = parseInt($(tbHeight).val());
        if (!isNaN(width) && !isNaN(height)) {
            for (layer of FORTE.layers) {
                layer.setResolution(width, height);
            }
        }
    }
}

FORTE.switchLayer = function (e) {
    var idx = parseInt($(e.target).val());
    if (!isNaN(idx)) {
        FORTE.layer = FORTE.layers[idx];
        FORTE.toggleLayerZindex(idx);
    }
}

FORTE.toggleLayerZindex = function (idxTop) {
    for (var i = 0; i < FORTE.layers.length; i++) {
        var zindex = i == idxTop ? FORTE.layers.length - 1 : 0;
        FORTE.layers[i]._canvas.css('z-index', zindex);
    }
}
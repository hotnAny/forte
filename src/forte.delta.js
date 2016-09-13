/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	handling adding detla of design to an object and interacting with it
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

FORTE.Delta = function(designOriginal, designNew, canvas, scene, camera) {
    FORTE.deltas = FORTE.deltas || [];

    var id = FORTE.deltas.length;
    this._interpolation = new FORTE.Interpolation(designOriginal, designNew, scene, camera);

    //
    // make the transient slider
    //
    var bbox = FORTE.Delta._findBoundingBox(designNew);

    // unproject it to screen coordinates
    //  ...

    // create a slider
    this._slider = $('<div id=' + id + '></div>');
    this._slider.slider({
        orientation: "vertical",
        range: "min",
        min: FORTE.Delta.SLIDERMIN,
        max: FORTE.Delta.SLIDERMAX,
        value: FORTE.Delta._transfer(1, true) * (FORTE.Delta.SLIDERMAX - FORTE.Delta.SLIDERMIN) +
            FORTE.Delta.SLIDERMIN,
        slide: function(event, ui) {
            var t = (ui.value - FORTE.Delta.SLIDERMIN) / (FORTE.Delta.SLIDERMAX - FORTE.Delta
                .SLIDERMIN);
            t = FORTE.Delta._transfer(t);
            var delta = FORTE.deltas[this.id];
            delta._designNew = delta._interpolation.interpolate(t);
            FORTE.updateDeltas();
            event.stopPropagation();
        }
    });

    this._designNew = this._interpolation.interpolate(1);
    // FORTE.updateDeltas(true);

    var rect = canvas.getBoundingClientRect();
    this._slider.css('position', 'absolute');
    this._slider.css('left', (rect.left + 15) + 'px');
    this._slider.css('top', (rect.top + 15) + 'px');
    this._slider.css('height', FORTE.Delta.SLIERHEIGHT + 'px');
    FORTE.tdCanvas.append(this._slider);
}

FORTE.Delta.SLIDINGBASE = 5;
FORTE.Delta.OUTSLIDINGRATIO = 1.2;
FORTE.Delta.SLIDERMAX = 100;
FORTE.Delta.SLIDERMIN = 0;
FORTE.Delta.SLIERHEIGHT = 200;

FORTE.Delta.prototype = {
    constructor: FORTE.Delta
}

FORTE.Delta._findBoundingBox = function(design) {

}

FORTE.Delta._transfer = function(t, inverse) {
    if (inverse) {
        return (Math.pow(FORTE.Delta.SLIDINGBASE, t / FORTE.Delta.OUTSLIDINGRATIO) - 1) / (FORTE.Delta.SLIDINGBASE -
            1);
    }
    return FORTE.Delta.OUTSLIDINGRATIO * Math.getBaseLog(FORTE.Delta.SLIDINGBASE, t * (FORTE.Delta.SLIDINGBASE -
        1) + 1);
}

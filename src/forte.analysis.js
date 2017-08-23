// ......................................................................................................
//
//  >>>>>>>>>>>>>>>> 08/2017: currently unused <<<<<<<<<<<<<<<<<
//
//  routines for analyzing stress
//
//  by xiangchen@acm.org, v0.1, 07/2017
//
// ......................................................................................................

//
//  update the stress information, stored in a canvas
//
//      - displacements
//      - x0, y0: the origin of the design relative to the canvas
//      - width, height: the width and height of the design as a sub area of the canvas
//      - bitmap: the bitmap showing material density of the elements
//      - thres: the threshold value to decide when to discard an element
//
FORTE.GridCanvas.prototype.updateStress = function (displacements, x0, y0, width, height, bitmap, thres) {
    this._stressInfo = FORTE.computeStress(displacements, x0, y0, width, height, bitmap, thres);
    this._stressInfo.x0 = x0;
    this._stressInfo.y0 = y0;
    this._stressInfo.width = width;
    this._stressInfo.height = height;
    return this._stressInfo.maxStress;
}

//
//  update a canvas' heatmap based on udpated maximum stress across a set of designs
//
FORTE.GridCanvas.prototype.updateHeatmap = function (maxStress, map) {
    if (this._stressInfo == undefined) return;

    var defaultColor = XAC.getHeatmapColor(0, maxStress);
    this._heatmap = XAC.initMDArray([this._gridHeight, this._gridWidth], defaultColor);
    for (var j = 0; j < this._stressInfo.height; j++) {
        for (var i = 0; i < this._stressInfo.width; i++) {
            var stress = FORTE.mapToUnits(this._stressInfo.stresses[j][i]);
            this._heatmap[j + this._stressInfo.y0][i + this._stressInfo.x0] =
                XAC.getHeatmapColor(stress, maxStress);
        }
    }
    return this._heatmap;
}

//
//  compute stress
//
//      for parameters see FORTE.GridCanvas.prototype.updateStress
//
FORTE.computeStress = function (displacements, x0, y0, width, height, bitmap, thres) {
    var E0 = 1,
        Emin = 1e-9;
    // var E = 1,
    //     nu = 0.3;
    // var C = [
    //     [1.125 * E, 0.375 * E, 0],
    //     [0.375 * E, 1.125 * E, 0],
    //     [0, 0, 0.375 * E]
    // ];
    var B = [
        [-0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0],
        [0, -0.5, 0, -0.5, 0, 0.5, 0, 0.5],
        [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5]
    ];
    // var cb = numeric.dot(C, B);
    var sq = function (x) {
        return x * x;
    };

    var vonMises = [];
    var maxStress = 0;
    // var allStresses = [];
    for (var j = 0; j < height; j++) {
        var vmrow = [];
        for (var i = 0; i < width; i++) {
            //  3---2
            //  |   |
            //  0---1

            var n0 = i * (height + 1) + j + 1;
            var n1 = (i + 1) * (height + 1) + j + 1;
            var n2 = (i + 1) * (height + 1) + j;
            var n3 = i * (height + 1) + j;
            var nodes = [n0, n1, n2, n3];

            var arrDisps = [];

            // for (node of nodes) arrDisps.push(displacements[node]);
            for (node of nodes) arrDisps.push(displacements[2 * node], displacements[2 * node + 1]);

            var density = Math.pow(bitmap[y0 + j][x0 + i], 3); // < thres ? 0 : 1;
            var E = Emin + density * (E0 - Emin);

            var C = [
                [1.0989 * E, 0.3297 * E, 0],
                [0.3297 * E, 1.100 * E, 0],
                [0, 0, 0.3846 * E]
            ];
            var cb = numeric.dot(C, B);

            var sigma = numeric.dot(cb, numeric.transpose([arrDisps]));
            var s11 = sigma[0][0];
            var s22 = sigma[1][0];
            // var s33 = 0;
            var s12 = sigma[2][0];
            // var s23 = 0 * 0.5;
            // var s31 = 0 * 0.5;

            // 3d von mises
            // var stress = Math.sqrt(0.5 * (sq(s11 - s22) + sq(s22 - s33) + sq(s33 - s11) +
            //     6 * (sq(s12) + sq(s23) + sq(s31))));

            var stress = Math.sqrt(s11 * s11 + s22 * s22 + s12 * s12 - s11 * s22 + 2 * s12 * s12);

            //
            //  [debug] computing displacement per element
            //

            // var vdisp = {
            //     x: 0,
            //     y: 0
            // };

            // for (node of nodes) {
            //     vdisp.x += displacements[2 * node];
            //     vdisp.y += displacements[2 * node + 1];
            // }

            // vdisp.x /= 4;
            // vdisp.y /= 4;

            // var disp = Math.sqrt(Math.pow(vdisp.x, 2) + Math.pow(vdisp.y, 2));


            if (!isNaN(stress)) {
                vmrow.push(stress);
                maxStress = Math.max(maxStress, stress);
                // allStresses.push(stress);
            } else {
                vmrow.push(0);
                // allStresses.push(0);
            }
        }
        vonMises.push(vmrow);
    }

    // [debug]
    // var __trim = function (value, ndigits) {
    //     if (ndigits < 1) return value;
    //     var divider = Math.pow(10, ndigits);
    //     return ((value * divider) | 0) / (divider * 1.0);
    // }
    // for (var i = 0; i < width; i++) {
    //     vmcol = [];
    //     for (var j = 0; j < height; j++) vmcol.push(__trim(vonMises[j][i], 4));
    //     log(vmcol);
    // }

    // allStresses.sort(function (x, y) {
    //     if (x < y) return -1
    //     else if (x > y) return 1;
    //     else return 0
    // });

    // log(allStresses)

    log(maxStress)

    return {
        stresses: vonMises,
        maxStress: maxStress
    };
}
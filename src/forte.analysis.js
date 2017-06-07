// ......................................................................................................
//
//  routines for analyzing stress
//
//  by xiangchen@acm.org, v0.0, 06/2017
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
FORTE.GridCanvas.prototype.updateHeatmap = function (maxStress) {
    if (this._stressInfo == undefined) return;

    this._heatmap = XAC.initMDArray([this._gridHeight, this._gridWidth], undefined);
    for (var j = 0; j < this._stressInfo.height; j++) {
        for (var i = 0; i < this._stressInfo.width; i++) {
            this._heatmap[j + this._stressInfo.y0][i + this._stressInfo.x0] =
                XAC.getHeatmapColor(this._stressInfo.stresses[j][i], maxStress);
        }
    }
    return this._heatmap;
}

// C & B matrices
// Matrix([[1.125*E, 0.375*E, 0], [0.375*E, 1.125*E, 0], [0, 0, 0.375*E]])
// Matrix([[-0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0], [0, -0.5, 0, -0.5, 0, 0.5, 0, 0.5], [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5]])

//
//  compute stress
//
//      for parameters see FORTE.GridCanvas.prototype.updateStress
//
FORTE.computeStress = function (displacements, x0, y0, width, height, bitmap, thres) {
    // hardcoded for now
    var E = 1,
        nu = 0.3;
    var C = [
        [1.125 * E, 0.375 * E, 0],
        [0.375 * E, 1.125 * E, 0],
        [0, 0, 0.375 * E]
    ];
    var B = [
        [-0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0],
        [0, -0.5, 0, -0.5, 0, 0.5, 0, 0.5],
        [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5]
    ];
    var cb = numeric.dot(C, B);
    var sq = function (x) {
        return x * x;
    };

    var vonMises = [];
    var maxStress = 0;
    for (var j = 0; j < height; j++) {
        var vmrow = [];
        for (var i = 0; i < width; i++) {
            //  0---3
            //  |   |
            //  1---2
            var n0 = i * (height + 1) + j;
            var n1 = (i + 1) * (height + 1) + j;
            var n2 = (i + 1) * (height + 1) + j + 1;
            var n3 = i * (height + 1) + j + 1;

            var nodes = [n0, n1, n2, n3];

            var arrDisps = [];

            for (node of nodes) arrDisps.push(displacements[2 * node], displacements[2 * node + 1]);

            var sigma = numeric.dot(cb, numeric.transpose([arrDisps]));
            var s11 = sigma[0][0];
            var s22 = sigma[1][0];
            var s33 = 0;
            var s12 = sigma[2][0] * 0.5;
            var s23 = 0 * 0.5;
            var s31 = 0 * 0.5;

            var stress = Math.sqrt(0.5 * (sq(s11 - s22) + sq(s22 - s33) + sq(s33 - s11) +
                6 * (sq(s12) + sq(s23) + sq(s31))));
            // log(stress)
            var density = bitmap[y0 + j][x0 + i] < thres ? 0 : 1;
            stress *= density;
            vmrow.push(stress);
            maxStress = Math.max(maxStress, stress);
        }
        vonMises.push(vmrow);
    }

    log(maxStress)

    return {
        stresses: vonMises,
        maxStress: maxStress
    };
}
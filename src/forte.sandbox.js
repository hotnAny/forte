$(document).ready(function () {
    FORTE.m = 1;
    $(document).keydown(XAC.keydown);
    XAC.on(XAC.UPARROW, function (e) {
        FORTE.m *= 2;
        log(FORTE.m);
    });
    XAC.on(XAC.DOWNARROW, function (e) {
        FORTE.m /= 2;
        log(FORTE.m);
    });
});

//
//
//
FORTE.GridCanvas.prototype.showDisplacements = function (displacements, width, height) {
    var heatmap = XAC.initMDArray([height, width]);
    var maxDisp = 0;
    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            //  0---3
            //  |   |
            //  1---2
            var n0 = i * (height + 1) + j;
            var n1 = (i + 1) * (height + 1) + j;
            var n2 = (i + 1) * (height + 1) + j + 1;
            var n3 = i * (height + 1) + j + 1;

            var nodes = [n0, n1, n2, n3];

            var vdisp = {
                x: 0,
                y: 0
            };
            // var dispValue = 0;

            for (node of nodes) {
                vdisp.x += displacements[2 * node];
                vdisp.y += displacements[2 * node + 1];
            }

            vdisp.x /= 4;
            vdisp.y /= 4;

            var dispValue = Math.sqrt(Math.pow(vdisp.x, 2) + Math.pow(vdisp.y, 2));

            if (!isNaN(dispValue)) maxDisp = Math.max(maxDisp, dispValue);
            else console.error('NaN!')
            heatmap[j][i] = dispValue;
        }
        // log(heatmap[j])
    }

    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            heatmap[j][i] = XAC.getHeatmapColor(heatmap[j][i], maxDisp);
            // log(heatmap[j][i])
        }
    }

    return heatmap;
}

FORTE.GridCanvas.prototype.showStress = function (displacements, width, height, bitmap) {
    var stressInfo = FORTE.computeStress(displacements, width, height, bitmap);

    var heatmap = XAC.initMDArray([height, width]);
    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            heatmap[j][i] = XAC.getHeatmapColor(stressInfo.stresses[j][i], stressInfo.maxStress);
            // log(heatmap[j][i])
        }
    }
    return heatmap;
}

// Matrix([[1.125*E, 0.375*E, 0], [0.375*E, 1.125*E, 0], [0, 0, 0.375*E]])
// Matrix([[-0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0], [0, -0.5, 0, -0.5, 0, 0.5, 0, 0.5], [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5]])


FORTE.computeStress = function (displacements, width, height, bitmap) {
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

            for (node of nodes) {
                arrDisps.push(displacements[2 * node], displacements[2 * node + 1]);
            }
            // log(arrDisps)
            var sigma = numeric.dot(cb, numeric.transpose([arrDisps]));
            var s11 = sigma[0][0];
            var s22 = sigma[1][0];
            var s33 = 0;
            var s12 = sigma[2][0] * 0.5;
            var s23 = 0;
            var s31 = 0;

            var stress = Math.sqrt(0.5 * (sq(s11 - s22) + sq(s22 - s33) + sq(s33 - s11) +
                6 * (sq(s12) + sq(s23) + sq(s31))));
            // log(stress)
            var density = bitmap[j][i];
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
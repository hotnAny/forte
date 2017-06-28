//
//
//
FORTE.readStressData = function () {
    var baseDir = FORTE.outDir + '/' + FORTE.trial;
    var stressFieldLabels = ['before', 'after'];
    for (var i = 0; i < stressFieldLabels.length; i++) {
        var label = stressFieldLabels[i];
        XAC.readTextFile(baseDir + '_' + label + '.vms',
            // success
            function (text) {
                var stresses = FORTE.getBitmap(text);
                var maxStress = 0;
                var allStresses = [];
                var eps = 1e-9;
                var minStress = Math.log(eps);
                var logBase = Math.log(1.01);
                for (row of stresses)
                    for (value of row) {
                        allStresses.push(value);
                    }

                var percentile = 0.99;
                maxStress = allStresses.median(percentile);

                var layer = label == 'before' ? FORTE.designLayer : FORTE.optimizedLayer;
                layer._stressInfo = {
                    x0: FORTE.design.bbox.xmin,
                    y0: FORTE.design.bbox.ymin,
                    width: FORTE.resolution[0],
                    height: FORTE.resolution[1],
                    stresses: stresses,
                    maxStress: maxStress
                }

                if (label == 'after') {
                    FORTE.design.maxStress = Math.max(maxStress, FORTE.design.maxStress);
                    // FORTE.updateStressAcrossLayers(FORTE.toShowStress);
                }
            },
            // failure
            function () {
                setTimeout(FORTE.readStressData, 250);
            }
        );
    }
}
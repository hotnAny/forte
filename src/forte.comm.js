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

//
//
//
FORTE.readOptimizationOutput = function () {
    var baseDir = FORTE.outDir + '/' + FORTE.trial;
    XAC.readTextFile(baseDir + '_' + (FORTE.itrCounter + 1) + '.out',
        // on success
        function (text) {
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 0.75, FORTE.fetchInterval * 0.9);
            var bitmap = FORTE.getBitmap(text);
            FORTE.design.bitmaps.push(bitmap);
            if (FORTE.itrCounter >= FORTE.DELAYEDSTART && !FORTE.renderStarted) {
                FORTE.renderInterval = FORTE.RENDERINTERVAL;
                FORTE.render(0);
                FORTE.renderStarted = true;
                time();
            }

            time('fetched data for itr# ' + (FORTE.itrCounter + 1) +
                ' after failing ' + FORTE.failureCounter + ' time(s)');
            FORTE.itrCounter += 1;
            setTimeout(FORTE.fetchData, FORTE.fetchInterval);
            FORTE.failureCounter = 0;
        },
        // on failure
        function () {
            FORTE.__misses++;
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 2.5, FORTE.fetchInterval * 1.1);
            if (FORTE.itrCounter == 0) {
                setTimeout(FORTE.fetchData, FORTE.fetchInterval);
                // FORTE.fetchInterval *= 1.1;
            } else {
                FORTE.failureCounter++;
                if (FORTE.failureCounter > FORTE.GIVEUPTHRESHOLD) {
                    FORTE.state = 'finished';
                    log('data fetching finished');

                    // update tags
                    var numLayers = Object.keys(FORTE.htOptimizedLayers).length;
                    var label = 'layer ' + (numLayers + 1);
                    FORTE.htOptimizedLayers[label] = FORTE.optimizedLayer;
                    var tag = FORTE.optimizedLayerList.tagit('createTag', label);
                    FORTE.showOptimizedLayer(tag, label);

                    //  read stresses
                    FORTE.readStressData();

                    log('misses: ' + FORTE.__misses);

                    FORTE.resetButtonFromOptimization($('#btnGetVariation'), FORTE.LABELGETVARIATION);
                    FORTE.resetButtonFromOptimization($('#btnAddStructs'), FORTE.LABELADDSTRUCTS);

                    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);
                } else {
                    setTimeout(FORTE.fetchData, FORTE.fetchInterval);
                }
            }
        });
}
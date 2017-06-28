// .....................................................................................................
//
//  routines for communication, e..g, r/w design files, communicate with topopt server
//
//  by xiangchen@acm.org, v0.0, 06/2017
//
// .....................................................................................................

var FORTE = FORTE || {};

//
//
//
FORTE.loadForteFile = function (e) {
    var dataObject = JSON.parse(e.target.result);
    $(tbWidth).val(dataObject.width);
    $(tbHeight).val(dataObject.height);
    FORTE.changeResolution();
    FORTE.btnNew.trigger('click');

    FORTE.designLayer.drawFromBitmap(dataObject.designBitmap, 0, 0);
    FORTE.emptinessLayer.drawFromBitmap(dataObject.emptinessBitmap, 0, 0);
    FORTE.loadLayer.drawFromBitmap(dataObject.loadBitmap, 0, 0);
    for (arrow of dataObject.loadArrows) {
        FORTE.drawArrow(FORTE.loadLayer._context, arrow[0], arrow[1], arrow[2], arrow[3]);
    }
    FORTE.design.loadPoints = dataObject.loadPoints;
    FORTE.design.loadValues = dataObject.loadValues;
    FORTE.boundaryLayer.drawFromBitmap(dataObject.boundaryBitmap, 0, 0);
}

//
//
//
FORTE.saveForteToFile = function () {
    var dataObject = {
        width: FORTE.width,
        height: FORTE.height,
        designBitmap: FORTE.designLayer._bitmap,
        emptinessBitmap: FORTE.emptinessLayer._bitmap,
        loadBitmap: FORTE.loadLayer._bitmap,
        loadArrows: FORTE.loadLayer._arrows,
        loadPoints: FORTE.design.loadPoints,
        loadValues: FORTE.design.loadValues,
        boundaryBitmap: FORTE.boundaryLayer._bitmap
    }
    var data = JSON.stringify(dataObject);
    if (data != undefined) {
        var blob = new Blob([data], {
            type: 'text/plain'
        });
        saveAs(blob, 'design.forte');
    }
}

//
//  routine to fetch data from matlab output
//
FORTE.fetchData = function () {
    if (FORTE.state == 'started') {
        FORTE.itrCounter = 0;
        log('data fetching started');
        FORTE.state = 'ongoing';
        setTimeout(FORTE.fetchData, FORTE.FETCHINTERVAL);
        FORTE.optimizedLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#666666');
        FORTE.optimizedLayer._strokeRadius = FORTE.designLayer._strokeRadius;
        FORTE.fetchInterval = FORTE.FETCHINTERVAL;
        FORTE.failureCounter = 0;
        FORTE.__misses = 0;
        FORTE.design.bitmaps = [];
        FORTE.renderStarted = false;
        FORTE.pointer = 0;
    } else if (FORTE.state == 'finished') {
        return;
    } else {
        if (FORTE.outDir == undefined || FORTE.outDir == null)
            console.error('output directory unavailable');
        FORTE.readOptimizationOutput();
    }
}

//
//  parse matlab output text as a bitmap
//
FORTE.getBitmap = function (text) {
    var rowsep = '\n';
    var colsep = ',';

    if (text.charAt(text.length - 1) == rowsep)
        text = text.substring(0, text.length - 1);

    var rows = text.split(rowsep);

    var nrows = rows.length;
    var ncols = nrows > 0 ? rows[0].split(colsep).length : 0;

    if (nrows <= 0 || ncols <= 0) return;

    bitmap = [];
    for (row of rows) {
        var arrRowStr = row.split(colsep);
        var arrRow = [];
        for (str of arrRowStr) arrRow.push(parseFloat(str));
        bitmap.push(arrRow);
    }

    return bitmap;
}


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
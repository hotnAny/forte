// .....................................................................................................
//
//  routines for communication, e..g, r/w design files, communicate with topopt server
//
//  by xiangchen@acm.org, v0.1, 08/2017
//
// .....................................................................................................

var FORTE = FORTE || {};

//
//  routine to load forte design file
//
FORTE.loadForteFile = function (e) {
    var dataObject = JSON.parse(e.target.result);

    // set up canvas
    $(tbWidth).val(dataObject.design.width);
    $(tbHeight).val(dataObject.design.height);
    FORTE.changeResolution();
    FORTE.btnNew.trigger('click');

    // show initial design
    if (dataObject.design.srcPath != undefined)
        FORTE.designLayer.loadSVG(dataObject.design.srcPath);
    else
        FORTE.designLayer.drawFromBitmap(dataObject.design.designBitmap, 0, 0);

    FORTE.loadLayer.drawFromBitmap(dataObject.design.loadBitmap, 0, 0);
    FORTE.loadLayer._arrows = [];
    for (arrowNormalized of dataObject.design.loadArrows) {
        var w = FORTE.loadLayer._canvas[0].width;
        var h = FORTE.loadLayer._canvas[0].height;
        var arrow = [arrowNormalized[0] * w, arrowNormalized[1] * h, arrowNormalized[2] * w, arrowNormalized[3] * h];
        FORTE.drawArrow(FORTE.loadLayer._context, arrow[0], arrow[1], arrow[2], arrow[3]);
        FORTE.loadLayer._arrows.push(arrow);
    }
    FORTE.design.loadPoints = dataObject.design.loadPoints;
    FORTE.design.loadValues = dataObject.design.loadValues;
    FORTE.boundaryLayer.drawFromBitmap(dataObject.design.boundaryBitmap, 0, 0);

    // show trials (if there's any)
    // FORTE.optimizedLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLOROPTLAYER);
    FORTE.design.maxStress = 0;
    for (trial of dataObject.trials) {
        var layer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLOROPTLAYER);
        layer.drawFromBitmap(trial.designBitmap, 0, 0);
        layer.type = trial.type;
        layer._lastMaterialRatio = trial.materialRatio;
        layer._lastSimilarityRatio = trial.similarityRatio;
        layer._stressInfo = trial.stressInfo;
        FORTE.design.maxStress = Math.max(layer._stressInfo.maxStress);
        FORTE.htOptimizedLayers[trial.key] = layer;
        var tag = FORTE.optimizedLayerList.tagit('createTag', trial.key);
    }
    FORTE.showOptimizedLayer();
}

//
//  routine to save forte design file
//
FORTE.saveForteToFile = function () {
    // save forte design file
    var design = {
        width: FORTE.width,
        height: FORTE.height,
        designBitmap: FORTE.designLayer._bitmap,
        loadBitmap: FORTE.loadLayer._bitmap,
        loadArrows: FORTE.loadLayer.normalizedArrows(),
        loadPoints: FORTE.design.loadPoints,
        loadValues: FORTE.design.loadValues,
        boundaryBitmap: FORTE.boundaryLayer._bitmap,
        srcPath: FORTE.designLayer._srcPath
    };

    var trials = [];
    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) {
        var layer = FORTE.htOptimizedLayers[key];
        if (layer == undefined) continue;
        trials.push({
            key: key,
            designBitmap: layer._bitmap,
            stressInfo: layer._stressInfo,
            type: layer.type,
            materialRatio: layer._lastMaterialRatio,
            similarityRatio: layer._lastSimilarityRatio
        });
    }

    var project = {
        design: design,
        trials: trials
    }

    var dataProject = JSON.stringify(project);
    if (dataProject != undefined) {
        saveAs(new Blob([dataProject], {
            type: 'text/plain'
        }), 'design.forte');
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
        FORTE.timeouts.push(setTimeout(FORTE.fetchData, FORTE.FETCHINTERVAL));
        FORTE.fetchInterval = FORTE.FETCHINTERVAL;
        FORTE.failureCounter = 0;
        FORTE.__misses = 0;
        FORTE.design.bitmaps = [];
        FORTE.renderStarted = false;
        FORTE.pointer = 0;
    } else {
        if (FORTE.outputDir == undefined || FORTE.outputDir == null)
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
//  routine to read stress output from optimization
//
FORTE.readStressData = function () {
    var baseDir = FORTE.outputDir + '/' + FORTE.trial;
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
                log('before conversion maxStress: ' + maxStress);
                maxStress = FORTE.mapToUnits(maxStress);
                log('after conversion maxStress: ' + maxStress);

                var layer = label == 'before' ? FORTE.designLayer : FORTE.optimizedLayer;
                layer._stressInfo = {
                    x0: FORTE.design.bbox.xmin,
                    y0: FORTE.design.bbox.ymin,
                    width: FORTE.resolution[0],
                    height: FORTE.resolution[1],
                    stresses: stresses,
                    maxStress: maxStress
                }

                if (label == 'after') FORTE.design.maxStress = Math.max(maxStress, FORTE.design.maxStress);
            },
            // failure
            function () {
                FORTE.timeouts.push(setTimeout(FORTE.readStressData, 250));
            }
        );
    }
}

//
//  routine to read optimization output
//
FORTE.readOptimizationOutput = function () {
    FORTE.outputFile = FORTE.outputDir + '/' + FORTE.trial + '_' + (FORTE.itrCounter + 1) + '.out';
    XAC.readTextFile(FORTE.outputFile,
        // on success
        function (text) {
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 0.75, FORTE.fetchInterval * 0.9);
            var bitmap = FORTE.getBitmap(text);
            FORTE.design.bitmaps.push(bitmap);
            if (FORTE.itrCounter >= FORTE.DELAYEDSTART && !FORTE.renderStarted) {
                FORTE.renderInterval = FORTE.RENDERINTERVAL;

                var keys = Object.keys(FORTE.htOptimizedLayers);
                for (key of keys) {
                    var layer = FORTE.htOptimizedLayers[key];
                    if (layer != undefined) layer._canvas.remove();
                }
                FORTE.optimizedLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLOROPTLAYER);
                FORTE.optimizedLayer._strokeRadius = FORTE.designLayer._strokeRadius;
                FORTE.render(0);
                FORTE.renderStarted = true;
                time();
            }

            time('fetched data for itr# ' + (FORTE.itrCounter + 1) +
                ' after failing ' + FORTE.failureCounter + ' time(s)');
            FORTE.notify('rendering iteration #' + (FORTE.itrCounter + 1) + ' ...', false);
            FORTE.itrCounter += 1;
            FORTE.timeouts.push(setTimeout(FORTE.fetchData, FORTE.fetchInterval));
            FORTE.failureCounter = 0;

            FORTE.lastOutputFile = FORTE.outputFile;
        },
        // on failure
        function () {
            FORTE.__misses++;
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 2.5, FORTE.fetchInterval * 1.1);
            if (FORTE.itrCounter == 0) {
                FORTE.timeouts.push(setTimeout(FORTE.fetchData, FORTE.fetchInterval));
            } else {
                FORTE.failureCounter++;
                if (FORTE.failureCounter > FORTE.GIVEUPTHRESHOLD || FORTE.state == 'finished') {
                    FORTE.state = 'finished';
                    log('data fetching finished');

                    // update tags
                    var numLayers = Object.keys(FORTE.htOptimizedLayers).length;
                    var label = 'trial ' + (numLayers + 1);
                    FORTE.htOptimizedLayers[label] = FORTE.optimizedLayer;
                    FORTE.optimizedLayer.type = $('#ddOptType :selected').val();
                    FORTE.optimizedLayer._lastMaterialRatio = FORTE.materialRatio;
                    FORTE.optimizedLayer._lastSimilarityRatio = FORTE.similarityRatio;
                    FORTE.optimizedLayer.lastOutputFile = FORTE.lastOutputFile;
                    var tag = FORTE.optimizedLayerList.tagit('createTag', label);
                    FORTE.showOptimizedLayer(tag, label);

                    //  read stresses
                    FORTE.readStressData();

                    log('misses: ' + FORTE.__misses);

                    FORTE.resetButtonFromOptimization($('#btnOptCtrl'));

                    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);

                    $("body").css("cursor", "default");
                } else {
                    FORTE.timeouts.push(setTimeout(FORTE.fetchData, FORTE.fetchInterval));
                }
            }
        });
}

//
//  add blob to a dropdown list for later download
//
FORTE.addToDownloadDropdown = function (itemName, blob, fileName) {
    FORTE.downloadableInfo = FORTE.downloadableInfo || [];

    var downloadItem = $('<option value=' + FORTE.downloadableInfo.length + '>' + itemName + '</option>');
    FORTE.downloadableInfo.push({
        blob: blob,
        fileName: fileName
    });
    $('#ddlExports').append(downloadItem);
}
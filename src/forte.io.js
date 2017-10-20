// .....................................................................................................
//
//  routines for communication, e.g., r/w design files, communicate with topopt server
//
//  by xiangchen@acm.org, v1.0. 10/2017
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

    // update min/max to decide the bounding box of the design
    var layer = FORTE.designLayer;
    layer._min = {
        x: layer._canvas[0].width,
        y: layer._canvas[0].height
    };
    layer._max = {
        x: 0,
        y: 0
    };
    var bitmap = FORTE.designLayer._bitmap;
    var h = bitmap.length;
    var w = h > 0 ? bitmap[0].length : 0;
    for (var j = 0; j < h; j++) {
        for (var i = 0; i < w; i++) {
            if (bitmap[j][i] > 0) {
                layer._min.x = Math.min(layer._min.x, i * layer._cellSize);
                layer._min.y = Math.min(layer._min.y, j * layer._cellSize);
                layer._max.x = Math.max(layer._max.x, i * layer._cellSize);
                layer._max.y = Math.max(layer._max.y, j * layer._cellSize);
            }
        }
    }

    // draw original loading scenario
    FORTE.loadLayer.drawFromBitmap(dataObject.design.loadBitmap, 0, 0);

    FORTE.loadLayer._arrows = [];
    for (arrowNormalized of dataObject.design.loadArrows) {
        var w = FORTE.loadLayer._canvas[0].width;
        var h = FORTE.loadLayer._canvas[0].height;
        var arrow = [arrowNormalized[0] * w, arrowNormalized[1] * h, arrowNormalized[2] * w, arrowNormalized[3] * h];
        FORTE.drawArrow(FORTE.loadLayer._context, arrow[0], arrow[1], arrow[2], arrow[3]);
        FORTE.loadLayer._arrows.push(arrow);

        var loadLabel = $('<label class="ui-widget info-label" style="position:absolute;"></label>');
        loadLabel.css('opacity', FORTE.SHOWINFOLABELS ? FORTE.OPACITYDIMLABEL : 0);
        loadLabel.css('color', FORTE.loadLayer._strokeColor);
        FORTE.loadLabels = FORTE.loadLabels || [];
        FORTE.loadLabels.push(loadLabel);
        $(document.body).append(loadLabel);

        var a = arrow;
        var lengthArrow = Math.sqrt(Math.pow(a[0] - a[2], 2) + Math.pow(a[1] - a[3], 2));
        var forceValue = FORTE.mapToWeight(lengthArrow);
        loadLabel.html(XAC.trim(forceValue, 0) + ' kg');
        var labelOffset = 16;
        loadLabel.css('left', a[2] + labelOffset);
        loadLabel.css('top', a[3] + labelOffset);
    }
    FORTE.design.loadPoints = dataObject.design.loadPoints;
    FORTE.design.loadValues = dataObject.design.loadValues;

    // draw boundary
    FORTE.boundaryLayer.drawFromBitmap(dataObject.design.boundaryBitmap, 0, 0);

    // restore unit scale
    FORTE.sldrMeasurement.slider('value', FORTE._getSliderValue(
        (dataObject.lengthPerPixel - FORTE.MINLENGTHPERPIXEL) / (FORTE.MAXLENGTHPERPIXEL - FORTE.MINLENGTHPERPIXEL)
    ));

    // show trials (if there's any)
    FORTE.design.maxStress = 0;
    for (trial of dataObject.trials) {
        var layer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLOROPTLAYER);
        layer.drawFromBitmap(trial.designBitmap, 0, 0);
        layer.type = trial.type;
        layer._lastMaterialRatio = trial.materialRatio;
        layer._lastSimilarityRatio = trial.similarityRatio;
        layer._stressInfo = trial.stressInfo;
        FORTE.htOptimizedLayers[trial.key] = layer;
        var tag = FORTE.optimizedLayerList.tagit('createTag', trial.key);
    }
    FORTE.showOptimizedLayer();
}

//
//  routine to save forte design file
//
FORTE.saveForteToFile = function (toConsole) {
    // save forte design parameters
    var design = {
        width: FORTE.width,
        height: FORTE.height,
        designBitmap: FORTE.designLayer._bitmap,
        loadBitmap: FORTE.loadLayer._bitmap,
        loadArrows: FORTE.loadLayer.getNormalizedArrows(),
        loadPoints: FORTE.design.loadPoints,
        loadValues: FORTE.design.loadValues,
        boundaryBitmap: FORTE.boundaryLayer._bitmap,
        srcPath: FORTE.designLayer._srcPath
    };

    // save the trials
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

    // compile to a project
    var project = {
        design: design,
        lengthPerPixel: FORTE.lengthPerPixel,
        numElmsThickness: FORTE.numElmsThickness,
        trials: trials
    }

    // get project read for download
    var dataProject = JSON.stringify(project);
    if (toConsole) log(dataProject)
    else {
        if (dataProject != undefined) {
            saveAs(new Blob([dataProject], {
                type: 'text/plain'
            }), 'design.forte');
        }
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
        FORTE.misses = 0;
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

    // remove idling last line
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
    if (FORTE.stressRead) {
        log('stress already read');
        return;
    }

    var baseDir = FORTE.outputDir + '/' + FORTE.trial;
    var stressFieldLabels = ['after']; // it's possible to also read 'before'
    for (var i = 0; i < stressFieldLabels.length; i++) {
        var label = stressFieldLabels[i];
        XAC.readTextFile(baseDir + '_' + label + '.vms',
            // on success
            function (text) {
                FORTE.stressRead = true;

                var stresses = FORTE.getBitmap(text);

                var layer = label == 'before' ? FORTE.designLayer : FORTE.optimizedLayer;
                layer._stressInfo = {
                    x0: Math.max(FORTE.design.bbox.xmin - FORTE.design._margin, 0),
                    y0: Math.max(FORTE.design.bbox.ymin - FORTE.design._margin, 0),
                    width: FORTE.resolution[0],
                    height: FORTE.resolution[1],
                    stresses: stresses,
                }

                if (label == 'before') FORTE.stressRead = false;
                else {
                    log('read stress success!');
                    $('.tbmenu').css('opacity', '1');
                }
            },
            // on failure
            function () {
                if (!FORTE.__designMode && FORTE.numFailuresReadStress < FORTE.MAXNUMREADSTRESS)
                    FORTE.timeouts.push(setTimeout(FORTE.readStressData, 1000));
                else $('.tbmenu').css('opacity', '1');
                FORTE.numFailuresReadStress++;
                log('read stress failed for ' + FORTE.numFailuresReadStress + ' time(s).');
            }
        );
    }
}

//
//  routines to read optimization output
//
FORTE.readOptimizationOutput = function () {
    FORTE.outputFile = FORTE.outputDir + '/' + FORTE.trial + '_' + (FORTE.itrCounter + 1) + '.out';
    XAC.readTextFile(FORTE.outputFile,
        // on success
        function (text) {
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 0.75, FORTE.fetchInterval * 0.9);
            var bitmap = FORTE.getBitmap(text);
            FORTE.design.bitmaps.push(bitmap);

            // initialize the optimized layer
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
            FORTE.misses++;
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
                    FORTE.numFailuresReadStress = 0;
                    FORTE.notify('reading stress ...');
                    FORTE.readStressData();

                    log('misses: ' + FORTE.misses);

                    FORTE.resetButtonFromOptimization($('#btnOptCtrl'));

                    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);

                    $("body").css("cursor", "default");
                    $("canvas").css("cursor", "crosshair");
                } else {
                    FORTE.timeouts.push(setTimeout(FORTE.fetchData, FORTE.fetchInterval));
                }
            }
        });
}
// ......................................................................................................
//
//  a demo/test bed for accelerated 2d topology optimization
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.width = 240;
FORTE.height = 160;

$(document).ready(function () {
    time();

    // client-server setup
    FORTE.xmlhttp = new XMLHttpRequest();
    FORTE.xmlhttp.timeout = 1e9;
    FORTE.xmlhttp.onreadystatechange = function () {
        if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
            log(FORTE.xmlhttp.responseText);
            var outDir = XAC.getParameterByName('outdir', FORTE.xmlhttp.responseText);
            if (outDir != null && outDir != undefined) {
                FORTE.outDir = outDir;
                log('server output directory: ' + FORTE.outDir);
            }
        }
    }
    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);

    // stats window
    XAC.stats = new Stats();
    XAC.stats.domElement.style.position = 'absolute';
    XAC.stats.domElement.style.bottom = '0px';
    XAC.stats.domElement.style.left = '0px';

    //
    // enable drag and drop
    //
    XAC.enableDragDrop(function (files) {
        for (var i = files.length - 1; i >= 0; i--) {
            var reader = new FileReader();
            if (files[i].name.endsWith('forte')) {
                reader.onload = (function (e) {
                    // for (layer of FORTE.layers) layer._canvas.css('opacity', 1);
                    var dataObject = JSON.parse(e.target.result);
                    $(tbWidth).val(dataObject.width);
                    $(tbHeight).val(dataObject.height);
                    FORTE.changeResolution();
                    FORTE.btnClear.trigger('click');

                    FORTE.designLayer.drawFromBitmap(dataObject.designBitmap, 0, 0, 0);
                    FORTE.emptinessLayer.drawFromBitmap(dataObject.emptinessBitmap, 0, 0, 0);
                    FORTE.loadLayer.drawFromBitmap(dataObject.loadBitmap, 0, 0, 0);
                    for (arrow of dataObject.loadArrows) {
                        FORTE.drawArrow(FORTE.loadLayer._context, arrow[0], arrow[1], arrow[2], arrow[3]);
                    }
                    FORTE.design.loadPoints = dataObject.loadPoints;
                    FORTE.design.loadValues = dataObject.loadValues;
                    FORTE.boundaryLayer.drawFromBitmap(dataObject.boundaryBitmap, 0, 0, 0);
                    // FORTE.toggleLayerZindex(FORTE.layers.indexOf(FORTE.loadLayer));
                });
            }
            reader.readAsBinaryString(files[i]);
        }
    });

    var mainTable = $('<table></table>');
    $(document.body).append(mainTable);
    mainTable.load(FORTE.MAINTABLETEMPLATE, function (e) {
        // set font size
        $('*').each(function () {
            $(this).css('font-size', 'small');
        });

        //  new a design
        $('#btnNew').button();

        // material amount slider
        FORTE.materialRatio = 1.5;
        var ratio = (FORTE.materialRatio - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        $('#tdMaterial').width(FORTE.WIDTHMATERIALSLIDER);
        FORTE.sldrMaterial = XAC.makeSlider('sldrMaterial', 'material',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdMaterial'));
        FORTE.sldrMaterial.slider({
            change: function (event, ui) {
                var value = FORTE._normalizeSliderValue($(event.target), ui.value);
                FORTE.materialRatio = FORTE.MINMATERIALRATIO * (1 - value) + FORTE.MAXMATERIALRATIO * value;
            }
        })

        // brushes for design, load and boundary
        FORTE.nameBrushButtons = 'brushButtons';
        FORTE.resetRadioButtons(0);

        // clear
        $('#btnErase').attr('src', FORTE.ICONERASER);
        $('#btnErase').button();
        $('#btnErase').click(function (e) {
            for (layer of FORTE.layers) layer.clear();
            FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);
            FORTE.loadLayer._arrows = [];
        });

        //  similarity slider
        FORTE.similarityRatio = 4;
        var ratio = (FORTE.similarityRatio - FORTE.MINSIMILARITYRATIO) /
            (FORTE.MAXSIMILARITYRATIO - FORTE.MINSIMILARITYRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        $('#tdSimilarity').width('180px');
        FORTE.sldrSimilarity = XAC.makeSlider('sldrSimilarity', 'similarity',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdSimilarity'));
        FORTE.sldrSimilarity.slider({
            change: function (event, ui) {
                var value = FORTE._normalizeSliderValue($(event.target), ui.value);
                FORTE.similarityRatio = FORTE.MINSIMILARITYRATIO * (1 - value) +
                    FORTE.MAXSIMILARITYRATIO * value;
            }
        })

        //
        // suggest
        //        
        $('#btnGetVariation').button();
        $('#btnGetVariation').click(function (e) {
            FORTE.optimize();
        });

        //
        // add structs
        //
        $('#btnAddStructs').button();
        $('#btnAddStructs').click(function (e) {
            var _similarity = FORTE.similarityRatio;
            FORTE.similarityRatio = -1;
            FORTE.optimize();
            FORTE.similarityRatio = _similarity;
        });

        //
        // save
        //
        $('#btnSave').attr('src', FORTE.ICONSAVE);
        $('#btnSave').button();
        $('#btnSave').click(function (e) {
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
        });

        // more controls
        $('#btnMore').html(FORTE.HTMLCODETRIANGLEDOWN);
        $('#btnMore').css('font-size', 'x-small');
        $('#btnMore').click(function (e) {
            e.preventDefault();
            if ($('#trMoreCtrl').is(":visible")) {
                $('#trMoreCtrl').hide();
                $(this).html(FORTE.HTMLCODETRIANGLEDOWN);
            } else {
                $('#trMoreCtrl').show();
                $(this).html(FORTE.HTMLCODETRIANGLEUP)
            }
        });

        $('#trMoreCtrl').hide();

        // resolution
        $('#tbWidth').attr('value', FORTE.width);
        $('#tbHeight').attr('value', FORTE.height);
        $('#tbWidth').keydown(FORTE.keydown);
        $('#tbHeight').keydown(FORTE.keydown);

        //
        // layers of editing
        //
        FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#000000');
        FORTE.emptinessLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#fffa90');
        FORTE.emptinessLayer._strokeRadius = 3;
        FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#cc0000');
        FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#00afff');
        $('#tdCanvas').css('background', '#f0f0f0');

        FORTE.layers = [FORTE.designLayer, FORTE.emptinessLayer, FORTE.loadLayer, FORTE.boundaryLayer];
        FORTE.layer = FORTE.designLayer;
        FORTE.toggleLayerZindex(0);

        FORTE.customizeLoadLayer();
        FORTE.changeResolution();

        //
        // layers of optimization
        //
        FORTE.htOptimizedLayers = {};
        FORTE.optimizedPanel = $('#divOptimizedPanel');
        var topMarginPanel = 16;
        var rightMarginPanel = FORTE.WIDTHOPTIMIZEDPANEL;
        FORTE.optimizedPanel.width(FORTE.WIDTHOPTIMIZEDPANEL);
        var parentWidth = $('#tdCanvas').width();
        var parentHeight = $('#tdCanvas').height();
        FORTE.optimizedPanel.css('top', -parentHeight/2 + topMarginPanel);
        FORTE.optimizedPanel.css('left', parentWidth-rightMarginPanel);
        $('#tdCanvas').append(FORTE.optimizedPanel);

        FORTE.optimizedLayerList = $('<ul></ul>');
        FORTE.optimizedLayerList.addClass('ui-widget');
        FORTE.optimizedLayerList.tagit({
            onTagClicked: function (event, ui) {
                FORTE.showOptimizedLayer(ui.tag, ui.tagLabel);
            },
            beforeTagRemoved: function (event, ui) {
                var layer = FORTE.htOptimizedLayers[ui.tagLabel];
                if (layer != undefined) layer._canvas.remove();
                FORTE.htOptimizedLayers[ui.tagLabel] = undefined;

                FORTE.design.maxStress = 0;
                var keys = Object.keys(FORTE.htOptimizedLayers);
                for (key of keys) {
                    var layer2 = FORTE.htOptimizedLayers[key];
                    if (layer2 != undefined && layer2 != layer) {
                        FORTE.design.maxStress =
                            Math.max(FORTE.design.maxStress, layer2._stressInfo.maxStress);
                    }
                }

                FORTE.updateStressAcrossLayers(FORTE.design.maxStress);
            }
        });
        FORTE.optimizedPanel.append(FORTE.optimizedLayerList);

        // FORTE.optimizedLayerList.tagit('createTag', 'test');

        time('ready');
    });
});

//
//  global keydown handler
//
FORTE.keydown = function (e) {
    if (e.keyCode == XAC.ENTER) {
        FORTE.changeResolution();
    }
}

//
//
//
FORTE.resetRadioButtons = function (idx) {
    $('[name="' + FORTE.nameBrushButtons + '"]').remove();
    $('[name="lb' + FORTE.nameBrushButtons + '"]').remove();
    // ['&#9998;', '&#8709;', '&#9750;', '&#11034;']
    var imgSrcs = [FORTE.ICONDESIGN, FORTE.ICONVOID, FORTE.ICONLOAD, FORTE.ICONBOUNDARY];
    var labels = [];
    for (src of imgSrcs) labels.push('<img class="icon" src="' + src + '"></img>');
    FORTE.checkedButton = XAC.makeRadioButtons('brushButtons', labels, [0, 1, 2, 3],
        $('#tdBrushes'), idx);
    $('[name="' + FORTE.nameBrushButtons + '"]').on("click", function (e) {
        // $('[name="' + FORTE.nameBrushButtons + '"]').attr('checked', false);
        var checked = $(e.target).attr('checked');
        if (checked == 'checked') {
            FORTE.switchLayer(-1);
            FORTE.resetRadioButtons();
        } else {
            FORTE.switchLayer(parseInt($(e.target).val()));
            if (FORTE.checkedButton != undefined) FORTE.checkedButton.attr('checked', false);
            $(e.target).attr('checked', true);
            FORTE.checkedButton = $(e.target);
        }
    });

    if (FORTE.layers != undefined) FORTE.switchLayer(-1);
}


//
//  routine to fetch data from matlab output
//
FORTE.fetchData = function () {
    if (FORTE.state == 'start') {
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
        var baseDir = FORTE.outDir + '/' + FORTE.trial;
        XAC.readTextFile(baseDir + '_' + (FORTE.itrCounter + 1) + '.out',
            // on successfully reading results
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
                // }

                // FORTE.fetchInterval = FORTE.FETCHINTERVAL;
                FORTE.failureCounter = 0;
            },
            // on unsuccessfully reading results
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
                        var stressFieldLabels = ['before', 'after'];
                        for (var i = 0; i < stressFieldLabels.length; i++) {
                            var label = stressFieldLabels[i];
                            XAC.readTextFile(baseDir + '_' + label + '.vms', function (text) {
                                var stresses = FORTE.getBitmap(text);
                                var maxStress = 0;
                                var allStresses = [];
                                var eps = 1e-9;
                                var minStress = Math.log(eps);
                                var logBase = Math.log(1.01);
                                for (row of stresses)
                                    for (value of row) {
                                        // value = Math.log(Math.max(eps, value)) / logBase - minStress;
                                        // maxStress = Math.max(maxStress, value);
                                        allStresses.push(value);
                                    }

                                var percentile = 0.99;
                                maxStress = allStresses.median(percentile);
                                log(maxStress);

                                var layer = label == 'before' ? FORTE.designLayer : FORTE.optimizedLayer;
                                layer._stressInfo = {
                                    x0: FORTE.design.bbox.xmin,
                                    y0: FORTE.design.bbox.ymin,
                                    width: FORTE.resolution[0],
                                    height: FORTE.resolution[1],
                                    stresses: stresses,
                                    maxStress: maxStress
                                }

                                if (label == 'after') FORTE.updateStressAcrossLayers(maxStress);
                                console.info(FORTE.design.maxStress);
                            });
                        }

                        log('misses: ' + FORTE.__misses);

                    } else {
                        setTimeout(FORTE.fetchData, FORTE.fetchInterval);
                    }
                }
            });
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
//  only show selected optimized layer, given its label
//
FORTE.showOptimizedLayer = function (tag, label) {
    if (FORTE.selectedTag != undefined) {
        $(FORTE.selectedTag).removeClass('ui-state-highlight');
    }

    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) {
        var layer = FORTE.htOptimizedLayers[key];
        if (layer != undefined) layer._canvas.remove();
    }

    if (FORTE.selectedTag != undefined && FORTE.selectedTag[0] == tag[0]) {
        FORTE.selectedTag = undefined;
        return;
    }

    var layer = FORTE.htOptimizedLayers[label];
    if (layer != undefined) {
        layer._parent.append(layer._canvas);
        FORTE.selectedTag = tag;
        $(FORTE.selectedTag).addClass('ui-state-highlight');
    } else {
        FORTE.selectedTag = undefined;
    }
}

//
//
//
FORTE.render = function (pointer) {
    FORTE.pointer = FORTE.pointer || pointer;

    // if fetching data is not finished, add extrapolated bitmaps
    if (FORTE.state != 'finished' &&
        FORTE.pointer >= FORTE.design.bitmaps.length - 1 - FORTE.DELAYEDSTART) {
        FORTE.design.extrapolateBitmaps(0.5);
    }

    // render the next availale bitmap
    if (FORTE.pointer < FORTE.design.bitmaps.length) {
        var bitmap = FORTE.design.bitmaps[FORTE.pointer];
        FORTE.optimizedLayer.drawFromBitmap(bitmap, FORTE.design.bbox.xmin, FORTE.design.bbox.ymin, 0.1);
        XAC.stats.update();
        // time('redrew for itr# ' + (FORTE.pointer + 1) + ' with ' + FORTE.design.bitmaps.length + ' bitmaps stored.');
        FORTE.pointer++;

        setTimeout(function () {
            FORTE.render();
        }, FORTE.renderInterval);
    } else {
        log('rendering stopped.');
    }
}

//
//
//
FORTE.optimize = function () {
    FORTE.resetRadioButtons();

    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) {
        var layer = FORTE.htOptimizedLayers[key];
        if (layer != undefined) layer._canvas.remove();
    }

    FORTE.design.designPoints = FORTE.designLayer.package();
    FORTE.design.emptyPoints = FORTE.emptinessLayer.package();
    FORTE.design.boundaryPoints = FORTE.boundaryLayer.package();
    var dataObject = FORTE.design.getData();
    if (dataObject == undefined) return;

    FORTE.resolution = dataObject.resolution;

    var data = JSON.stringify(dataObject);
    if (data != undefined) {
        var fields = ['trial', 'forte', 'material', 'm'];
        FORTE.trial = 'forte_' + Date.now();
        var values = [FORTE.trial, data, FORTE.materialRatio, Math.pow(2, FORTE.similarityRatio)];
        XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', fields, values);
        FORTE.state = 'start';
        time();
        FORTE.fetchData();
    }
}

FORTE.updateStressAcrossLayers = function (maxStress) {
    FORTE.design.maxStress = Math.max(maxStress, FORTE.design.maxStress);
    var layers = [FORTE.designLayer];
    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) layers.push(FORTE.htOptimizedLayers[key]);
    for (layer of layers) {
        if (layer == undefined) continue;
        layer.updateHeatmap(FORTE.design.maxStress, function (x) {
            return x;
        });
        layer.forceRedraw(0.1, layer._heatmap);
    }
}

FORTE._getSliderValue = function (value) {
    return FORTE.MINSLIDER * (1 - value) + FORTE.MAXSLIDER * value;
}

FORTE._normalizeSliderValue = function (slider, value) {
    var max = slider.slider("option", "max");
    var min = slider.slider("option", "min");
    return (value - min) * 1.0 / (max - min);
}
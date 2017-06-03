// ......................................................................................................
//
//  a demo/test bed for accelerated 2d topology optimization
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

FORTE.width = 256;
FORTE.height = 192;
FORTE.FETCHINTERVAL = 200;
FORTE.RENDERINTERVAL = 40;
FORTE.MAXITERATIONS = 50;
FORTE.MINMATERIALRATIO = 0.5;
FORTE.MAXMATERIALRATIO = 2.5;
FORTE.GIVEUPTHRESHOLD = 5;
FORTE.DELAYEDSTART = 1;

$(document).ready(function () {
    time();

    // set font size
    $('*').each(function () {
        $(this).css('font-size', 'small');
    });

    // stats window
    XAC.stats = new Stats();
    XAC.stats.domElement.style.position = 'absolute';
    XAC.stats.domElement.style.top = '0px';
    XAC.stats.domElement.style.right = '0px';
    $(document.body).append(XAC.stats.domElement);

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
            //  [debug]
            else if (files[i].name.endsWith('out')) {
                reader.onload = (function (e) {
                    FORTE.bitmap = FORTE.getBitmap(e.target.result);
                });
            }
            //  [debug]
            else if (files[i].name.endsWith('dsp')) {
                reader.onload = (function (e) {
                    var displacements = e.target.result.split('\n');
                    for (var i = 0; i < displacements.length; i++) {
                        var disp = parseFloat(displacements[i]);
                        if (!isNaN(disp)) displacements[i] = disp;
                    }
                    var height = FORTE.bitmap.length;
                    var width = FORTE.bitmap[0].length;
                    log([width, height])
                    var heatmap = FORTE.designLayer.showStress(displacements, width, height, FORTE.bitmap);
                    FORTE.designLayer.drawFromBitmap(FORTE.bitmap, 50, 50, 0.5, heatmap);
                });
            }
            reader.readAsBinaryString(files[i]);
        }
    });

    //
    // resolution
    //
    var tbWidth = $('<input id="tbWidth" type="text" value="' + FORTE.width + '" size="3">');
    var tbHeight = $('<input id="tbHeight" type="text" value="' + FORTE.height + '" size="3">');
    $('#tdResolution').append(tbWidth);
    $('#tdResolution').append('&nbsp;×&nbsp;');
    $('#tdResolution').append(tbHeight);
    tbWidth.keydown(FORTE.keydown);
    tbHeight.keydown(FORTE.keydown);

    //
    // material amount slider
    //
    FORTE.materialRatio = 1.5;
    var minSlider = 0,
        maxSlider = 100;
    var ratio = (FORTE.materialRatio - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
    var valueSlider = minSlider * (1 - ratio) + maxSlider * ratio;
    $('#tdMaterial').width('192px');
    FORTE.sldrMaterial = XAC.makeSlider('sldrMaterial', 'material',
        0, 100, valueSlider, $('#tdMaterial'));
    FORTE.sldrMaterial.slider({
        change: function (event, ui) {
            var max = $(event.target).slider("option", "max");
            var min = $(event.target).slider("option", "min");
            var value = (ui.value - min) * 1.0 / (max - min);
            FORTE.materialRatio = FORTE.MINMATERIALRATIO * (1 - value) + FORTE.MAXMATERIALRATIO * value;
        }
    })

    //
    // brushes for design, load and boundary
    //
    FORTE.nameBrushButtons = 'brushButtons';
    FORTE.resetRadioButtons(0);

    // clear
    FORTE.btnClear = $('<div>clear</div>');
    FORTE.btnClear.button();
    FORTE.btnClear.click(function (e) {
        for (layer of FORTE.layers) layer.clear();
        FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);
    });
    $('#tdClear').append(FORTE.btnClear);

    //
    // run
    //
    FORTE.btnRun = $('<div>run</div>');
    FORTE.btnRun.button();
    FORTE.btnRun.click(function (e) {
        FORTE.resetRadioButtons();

        var keys = Object.keys(FORTE.htOptimizedLayers);
        for (key of keys) {
            var layer = FORTE.htOptimizedLayers[key];
            if (layer != undefined) layer._canvas.remove();
        }

        FORTE.design.designPoints = FORTE.designLayer.package();
        FORTE.design.emptyPoints = FORTE.emptinessLayer.package();
        FORTE.design.boundaryPoints = FORTE.boundaryLayer.package();
        var data = JSON.stringify(FORTE.design.getData());
        if (data != undefined) {
            FORTE.trial = 'forte_' + Date.now();
            XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', ['trial', 'forte', 'material', 'm'], [FORTE.trial, data, FORTE.materialRatio, FORTE.m]);
            FORTE.state = 'start';
            time();
            FORTE.fetchData();
        }

    });
    $('#tdRun').append(FORTE.btnRun);

    //
    // save
    //
    FORTE.btnSave = $('<div>save</div>');
    FORTE.btnSave.button();
    FORTE.btnSave.click(function (e) {
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
    $('#tdSave').append(FORTE.btnSave);

    //
    // layers of editing
    //
    FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#000000');
    FORTE.emptinessLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#fffa90');
    FORTE.emptinessLayer._strokeRadius = 3;
    FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#cc0000');
    FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#007fff');
    $('#tdCanvas').css('background', '#eeeeee');

    FORTE.layers = [FORTE.designLayer, FORTE.emptinessLayer, FORTE.loadLayer, FORTE.boundaryLayer];
    FORTE.layer = FORTE.designLayer;
    FORTE.toggleLayerZindex(0);

    FORTE.customizeLoadLayer();
    FORTE.changeResolution();

    FORTE.xmlhttp = new XMLHttpRequest();
    FORTE.xmlhttp.timeout = 1e9;
    FORTE.xmlhttp.onreadystatechange = function () {
        if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
            log(FORTE.xmlhttp.responseText);
            var outDir = XAC.getParameterByName('outdir', FORTE.xmlhttp.responseText);
            if (outDir != null && outDir != undefined) {
                FORTE.outDir = outDir;
                log('[log] server output directory: ' + FORTE.outDir);
            }
        }
    }

    //
    // layers of optimization
    //
    FORTE.htOptimizedLayers = {};
    var marginPanel = -5;
    var parentOffset = $('#tdCanvas').offset();
    FORTE.optimizedPanel = $('<div align="right"></div>');
    FORTE.optimizedPanel.width(96);
    FORTE.optimizedPanel.css('position', 'absolute');
    var parentWidth = $('#tdCanvas').width();
    FORTE.optimizedPanel.css('left', parentOffset.left + parentWidth -
        marginPanel - FORTE.optimizedPanel.width());
    FORTE.optimizedPanel.css('top', parentOffset.top + marginPanel);
    FORTE.optimizedPanel.css('z-index', 100);
    $('#tdCanvas').append(FORTE.optimizedPanel);

    FORTE.optimizedLayerList = $('<ul></ul>');
    FORTE.optimizedLayerList.tagit({
        onTagClicked: function (event, ui) {
            FORTE.showOptimizedLayer(ui.tag, ui.tagLabel);
        },
        beforeTagRemoved: function (event, ui) {
            var layer = FORTE.htOptimizedLayers[ui.tagLabel];
            if (layer != undefined) layer._canvas.remove();
            FORTE.htOptimizedLayers[ui.tagLabel] = undefined;
            // FORTE.showOptimizedLayer(ui.tag, ui.tagLabel);
        }
    });
    FORTE.optimizedPanel.append(FORTE.optimizedLayerList);

    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);
    time('ready.')
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
    FORTE.checkedButton = XAC.makeRadioButtons('brushButtons', ['design', 'emptiness', 'load', 'boundary'], [0, 1, 2, 3],
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
        log('[log] data fetching started');
        FORTE.state = 'ongoing';
        setTimeout(FORTE.fetchData, FORTE.FETCHINTERVAL);
        FORTE.optimizedLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, '#888888');
        FORTE.optimizedLayer._strokeRadius = FORTE.designLayer._strokeRadius;
        FORTE.fetchInterval = FORTE.FETCHINTERVAL;
        FORTE.failureCounter = 0;
        FORTE.__misses = 0;
        FORTE.design.bitmaps = [];
    } else if (FORTE.state == 'finished') {
        return;
    } else {
        if (FORTE.outDir == undefined || FORTE.outDir == null)
            console.error('output directory unavailable');
        var baseDir = FORTE.outDir + '/' + FORTE.trial;
        XAC.readTextFile(baseDir + '_' + (FORTE.itrCounter + 1) + '.out', function (text) {
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 0.75, FORTE.fetchInterval * 0.9);
            var bitmap = FORTE.getBitmap(text);
            if (FORTE.itrCounter < FORTE.MAXITERATIONS) {
                // FORTE.optimizedLayer.drawFromBitmap(bitmap, FORTE.design.bbox.xmin, FORTE.design.bbox.ymin, 0.5);
                // XAC.stats.update();
                FORTE.design.bitmaps.push(bitmap);
                if (FORTE.itrCounter == FORTE.DELAYEDSTART) {
                    FORTE.renderInterval = FORTE.RENDERINTERVAL;
                    FORTE.render(0);
                    time();
                }

                time('[log] fetched data for itr# ' + (FORTE.itrCounter + 1) + ' after failing ' + FORTE.failureCounter + ' time(s)');
                FORTE.itrCounter += 1;
                setTimeout(FORTE.fetchData, FORTE.fetchInterval);
            }

            // FORTE.fetchInterval = FORTE.FETCHINTERVAL;
            FORTE.failureCounter = 0;
        }, function () {
            FORTE.__misses++;
            FORTE.fetchInterval = Math.max(FORTE.FETCHINTERVAL * 2.5, FORTE.fetchInterval * 1.1);
            if (FORTE.itrCounter == 0) {
                setTimeout(FORTE.fetchData, FORTE.fetchInterval);
                // FORTE.fetchInterval *= 1.1;
            } else {
                FORTE.failureCounter++;
                if (FORTE.failureCounter > FORTE.GIVEUPTHRESHOLD) {
                    FORTE.state = 'finished';
                    log('[log] data fetching finished');
                    var numLayers = Object.keys(FORTE.htOptimizedLayers).length;
                    var label = 'layer ' + (numLayers + 1);
                    FORTE.htOptimizedLayers[label] = FORTE.optimizedLayer;
                    var tag = FORTE.optimizedLayerList.tagit('createTag', label);
                    FORTE.showOptimizedLayer(tag, label);

                    var displacementFileLabels = ['before', 'after'];
                    FORTE.design.displacements = [];
                    for (label of displacementFileLabels) {
                        XAC.readTextFile(baseDir + '_' + label + '.dsp', function (text) {
                            var displacements = text.split('\n');
                            for (var i = 0; i < displacements.length; i++) {
                                var disp = parseFloat(displacements[i]);
                                if (!isNaN(disp)) displacements[i] = disp;
                            }
                            FORTE.design.displacements.push(displacements);
                        });
                    }

                    log('[log] misses: ' + FORTE.__misses);

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
    if (FORTE.state != 'finished' && FORTE.pointer >= FORTE.design.bitmaps.length - 1 - FORTE.DELAYEDSTART) {
        FORTE.design.extrapolateBitmaps(0.5);
    }

    // render the next availale bitmap
    if (FORTE.pointer < FORTE.design.bitmaps.length) {
        var bitmap = FORTE.design.bitmaps[FORTE.pointer];
        FORTE.optimizedLayer.drawFromBitmap(bitmap, FORTE.design.bbox.xmin, FORTE.design.bbox.ymin, 0.5);
        XAC.stats.update();
        // time('[log] redrew for itr# ' + (FORTE.pointer + 1) + ' with ' + FORTE.design.bitmaps.length + ' bitmaps stored.');
        FORTE.pointer++;

        setTimeout(function () {
            FORTE.render();
        }, FORTE.renderInterval);
    } else {
        FORTE.pointer = 0;
        log('[log] rendering stopped.');
    }
}
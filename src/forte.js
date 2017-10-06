// .....................................................................................................
//
//  forte, v1.0
//
//  by xiangchen@acm.org, 10/2017
//
// .....................................................................................................

var FORTE = FORTE || {};

//
//  the ready function, mostly for ui
//
$(document).ready(function () {
    time();

    // global variables and data structures

    //  [debug] testing PLA properties
    //  currently no support for selecting other materials
    //  see materials.json for ref
    FORTE.e = 3.45e3; //MPa
    FORTE.nu = 0.36; //
    FORTE.yieldStress = 60 //MPa

    // global variables
    FORTE.timeouts = [];
    FORTE.notifications = [];
    FORTE.toShowStress = false;
    FORTE.loadLabels = [];

    // auto save
    FORTE.autoSave = function () {
        setTimeout(function () {
            try {
                if (!FORTE.renderStarted) FORTE.saveForteToFile();
            } catch (e) {
                log(e);
                log('did not save');
            }
            FORTE.autoSave();
        }, 300000);
    };

    // different modes
    var urlParams = XAC.getJsonFromUrl(window.location.href);
    log(urlParams);
    if (urlParams['study'] == 'true') {
        log('study mode');
        FORTE.autoSave();
    } else {
        log('dry run mode');
    }

    if (urlParams['design'] == 'true') FORTE.__designMode = true;
    else FORTE.__designMode = false;

    // client-server setup
    FORTE.xmlhttp = new XMLHttpRequest();
    FORTE.xmlhttp.timeout = 1e9;
    FORTE.xmlhttp.onreadystatechange = function () {
        if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
            log('server response: ' + FORTE.xmlhttp.responseText);
            var outDir = XAC.getParameterByName('outdir', FORTE.xmlhttp.responseText);
            if (outDir != null && outDir != undefined) {
                if (FORTE.outputDir == undefined) {
                    FORTE.outputDir = outDir;
                    log('server output directory: ' + FORTE.outputDir);
                    $('#divNotification').css('background', 'rgba(0, 0, 0, 0)');
                    $('#divNotification').css('color', '#000000');
                    FORTE.notify('optimization server ready.');
                }
            }

        }
    }

    // initial ping to get the output directory
    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);

    // enable drag and drop
    XAC.enableDragDrop(function (files) {
        if (files.length <= 0) return;
        var reader = new FileReader();
        if (files[0].name.endsWith('forte'))
            reader.onload = FORTE.loadForteFile;
        else if (files[0].name.endsWith('svg'))
            FORTE.designLayer.loadSVG(FORTE.DIRDESIGNDATA + '/' + files[0].name);
        else if (files[0].name.endsWith('jpg'))
            FORTE.setBackground(files[0].name);
        reader.readAsBinaryString(files[0]);
    });

    // loading main table
    var mainTable = $('<table></table>');
    $(document.body).append(mainTable);
    mainTable.load(FORTE.MAINTABLETEMPLATE, function (e) {

        // set font size
        $('*').each(function () {
            $(this).css('font-size', 'small');
        });

        FORTE.width = FORTE.WIDTHDEFAULT;
        FORTE.height = FORTE.HEIGHTDEFAULT;

        //  create a new design
        FORTE.btnNew = $('#btnNew');
        FORTE.btnNew.button();
        FORTE.btnNew.click(function (e) {
            for (layer of FORTE.layers) layer.clear();
            FORTE.design = new FORTE.Design(FORTE.width, FORTE.height);
            FORTE.loadLayer._arrows = [];
            var keys = Object.keys(FORTE.htOptimizedLayers);
            for (key of keys) {
                var layer = FORTE.htOptimizedLayers[key];
                if (layer != undefined) layer._canvas.remove();
            }
            FORTE.htOptimizedLayers = {};
            FORTE.optimizedLayerList.tagit('removeAll');

            for (lb of FORTE.loadLabels) lb.remove();
        });

        // material amount slider
        FORTE.materialRatio = FORTE.INITMATERIALRATIO;
        var ratio = (FORTE.materialRatio - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
        ratio = Math.pow(ratio, FORTE.MATSLDRPOWERRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        FORTE.sldrMaterial = XAC.makeSlider('sldrMaterial', 'material: x' + XAC.trim(FORTE.materialRatio, 1),
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdMaterial'), FORTE.WIDTHMATERIALSLIDER);
        FORTE.sldrMaterial.slider({
            slide: function (e, ui) {
                var value = FORTE._normalizeSliderValue($(e.target), ui.value);
                value = Math.pow(value, 1 / FORTE.MATSLDRPOWERRATIO);
                FORTE.materialRatio = FORTE.MINMATERIALRATIO * (1 - value) + FORTE.MAXMATERIALRATIO * value;
                log(FORTE.materialRatio)
                $('#lbsldrMaterial').html('material: x' + XAC.trim(FORTE.materialRatio, 1));
            }
        })

        // brushes for design, load and boundary
        FORTE.nameButtonsInputLayer = 'ButtonsInputLayer';
        FORTE.resetLayerButtons(0);

        // tools: brush vs. eraser
        FORTE.nameButtonsTools = 'ButtonsTools';
        FORTE.resetEditModeButtons();

        //  similarity slider
        FORTE.similarityRatio = 5;
        var ratio = (FORTE.similarityRatio - FORTE.MINSIMILARITYRATIO) /
            (FORTE.MAXSIMILARITYRATIO - FORTE.MINSIMILARITYRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        FORTE.sldrSimilarity = XAC.makeSlider('sldrSimilarity', 'similarity',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdSimilarity'), FORTE.WIDTHSIMILARITYSLIDER);
        FORTE.sldrSimilarity.slider({
            change: function (e, ui) {
                var value = FORTE._normalizeSliderValue($(e.target), ui.value);
                FORTE.similarityRatio = FORTE.MINSIMILARITYRATIO * (1 - value) +
                    FORTE.MAXSIMILARITYRATIO * value;
                log('similarity: ' + FORTE.similarityRatio);
            }
        });

        // control optimization
        $('#btnOptCtrl').attr('src', FORTE.ICONRUN);
        $('#btnOptCtrl').button();
        $('#btnOptCtrl').click(function (e) {
            if (FORTE.state == 'started' || FORTE.state == 'ongoing') {
                FORTE.finishOptimization();
                $('#btnOptCtrl').attr('src', FORTE.ICONRUN);
            } else {
                if (FORTE.optFrozen) return;
                if (FORTE.startOptimization()) {
                    FORTE.resetLayerButtons();
                    FORTE.setButtonForOptimization($(this));
                    $('#btnOptCtrl').attr('src', FORTE.ICONSTOP);
                }
            }
        });

        // show stress
        $('#btnShow').attr('src', FORTE.ICONEYE);
        $('#btnShow').button();
        $('#btnShow').click(function (e) {
            FORTE.toShowStress = !FORTE.toShowStress;
            $(this).toggleClass('ui-state-active');
            FORTE.updateStressAcrossLayers(FORTE.toShowStress);
        });

        // more controls
        $('#btnMore').html(FORTE.HTMLCODETRIANGLEDOWN);
        $('#btnMore').click(function (e) {
            e.preventDefault();
            if ($('#divMoreCtrl').is(":visible")) {
                $('#divMoreCtrl').hide();
                $(this).html(FORTE.HTMLCODETRIANGLEDOWN);
            } else {
                $('#divMoreCtrl').width($('#tdCanvas').width());
                $('#divMoreCtrl').show();
                $(this).html(FORTE.HTMLCODETRIANGLEUP);
            }
        });

        $('#divMoreCtrl').css('z-index', ++FORTE.MAXZINDEX);
        var _parentOffset = $('#tdCanvas').offset();
        $('#divMoreCtrl').css('left', _parentOffset.left);
        $('#divMoreCtrl').css('top', _parentOffset.top);
        $('#divMoreCtrl').hide();

        // notification
        $('#divNotification').width($('#tdCanvas').width());
        $('#divNotification').css('top', _parentOffset.top + 5);

        // resolution
        $('#tbWidth').attr('value', FORTE.width);
        $('#tbHeight').attr('value', FORTE.height);
        var _keydown = function (e) {
            if (e.keyCode == XAC.ENTER) {
                FORTE.changeResolution();
            }
        }
        $('#tbWidth').keydown(_keydown);
        $('#tbHeight').keydown(_keydown);

        // edit weight
        FORTE.editWeightRatio = 0.1;
        var ratio = (FORTE.editWeightRatio - FORTE.MINEDITWEIGHTRATIO) /
            (FORTE.MAXEDITWEIGHTRATIO - FORTE.MINEDITWEIGHTRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        FORTE.sldrEditWeight = XAC.makeSlider('sldrEditWeight', 'edit weight',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdEditWeight'), FORTE.WIDTHEDITWEIGHTSLIDER);
        FORTE.sldrEditWeight.slider({
            change: function (e, ui) {
                var value = FORTE._normalizeSliderValue($(e.target), ui.value);
                FORTE.editWeightRatio = FORTE.MINEDITWEIGHTRATIO * (1 - value) +
                    FORTE.MAXEDITWEIGHTRATIO * value;
            }
        });

        // measurements
        $('#imgLegend').attr('src', 'assets/legend.svg');
        FORTE.lengthPerPixel = FORTE.INITLENGTHPERPIXEL;
        FORTE.newtonPerPixel = 0.01 * FORTE.lengthPerPixel;
        var ratio = (FORTE.lengthPerPixel - FORTE.MINLENGTHPERPIXEL) / (FORTE.MAXLENGTHPERPIXEL - FORTE.MINLENGTHPERPIXEL);
        var valueSlider = FORTE._getSliderValue(ratio);
        FORTE.sldrMeasurement = XAC.makeSlider('sldrMeasurement', '',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdMeasurements'), FORTE.WIDTHMEASUREMENTSLIDER);
        FORTE.updateMeasurements = function (e, ui) {
            var value = FORTE._normalizeSliderValue($(e.target), ui.value);
            FORTE.lengthPerPixel = FORTE.MINLENGTHPERPIXEL * (1 - value) + FORTE.MAXLENGTHPERPIXEL * value;
            FORTE.newtonPerPixel = 0.1 * FORTE.lengthPerPixel;
            var widthLegend = parseInt($('#imgLegend').css('width'));
            $('#lbMeasurements').html(XAC.trim(FORTE.lengthPerPixel * widthLegend, 0) + ' mm');
            FORTE.designLayer.updateDimInfo();
            log(FORTE.lengthPerPixel)
        };
        FORTE.sldrMeasurement.slider({
            slide: FORTE.updateMeasurements,
            change: function (e, ui) {
                FORTE.updateMeasurements(e, ui);
                if (FORTE.htOptimizedLayers != undefined)
                    FORTE.updateStressAcrossLayers(FORTE.toShowStress);
            }
        });
        var widthLegend = parseInt($('#imgLegend').css('width'));
        $('#lbMeasurements').html(XAC.trim(FORTE.lengthPerPixel * widthLegend, 0) + ' mm');
        log(FORTE.lengthPerPixel)

        // thickness
        var valueSlider = FORTE._getSliderValue(0);
        FORTE.sldrThickness = XAC.makeSlider('sldrThickness', '', FORTE.MINSLIDER, FORTE.MAXSLIDER,
            valueSlider, $('#tdThickness'), FORTE.WIDTHTHICKNESSSLIDER);
        FORTE.updateSldrThickness = function (e, ui) {
            var value = FORTE._normalizeSliderValue($(e.target), ui.value);
            FORTE.numElmsThickness = (FORTE.minElmsThickness * (1 - value) + FORTE.maxElmsThickness * value) | 0;
            FORTE.actualThickness = FORTE.numElmsThickness * FORTE.designLayer._cellSize * FORTE.lengthPerPixel;
            $('#lbThickness').html(XAC.trim(FORTE.actualThickness, 0) + ' mm');
        };
        FORTE.sldrThickness.slider({
            slide: FORTE.updateSldrThickness,
            change: function (e, ui) {
                FORTE.updateSldrThickness(e, ui);
                if (FORTE.htOptimizedLayers != undefined)
                    FORTE.updateStressAcrossLayers(FORTE.toShowStress);
            }
        });

        // safety
        FORTE.safety = 1;
        var valueSlider = FORTE._getSliderValue((FORTE.safety - FORTE.MINSAFETY) /
            (FORTE.MAXSAFETY - FORTE.MINSAFETY));
        FORTE.sldrSafety = XAC.makeSlider('sldrSafety', '', FORTE.MINSLIDER, FORTE.MAXSLIDER,
            valueSlider, $('#tdSafety'), FORTE.WIDTHSAFETYSLIDER);
        FORTE.updateSldrSafety = function (e, ui) {
            var value = FORTE._normalizeSliderValue($(e.target), ui.value);
            value = Math.pow(value, 3);
            FORTE.safety = FORTE.MINSAFETY * (1 - value) + FORTE.MAXSAFETY * value;
        };
        FORTE.sldrSafety.slider({
            slide: FORTE.updateSldrSafety,
            change: function (e, ui) {
                FORTE.updateSldrSafety(e, ui);
                log(FORTE.lengthPerPixel);
                if (FORTE.htOptimizedLayers != undefined)
                    FORTE.updateStressAcrossLayers(FORTE.toShowStress);
            }
        });
        FORTE.sldrSafety.slider('value', valueSlider);

        // save
        $('#btnSave').attr('src', FORTE.ICONSAVE);
        $('#btnSave').button();
        $('#btnSave').click(function (e) {
            FORTE.saveForteToFile();
        });

        // exports drop down list
        $('#ddlExports').change(function () {
            var idx = $('#ddlExports :selected').val();
            var info = MEDLEY.downloadableInfo[idx];
            saveAs(info.blob, info.fileName);
        })

        //  input event handlers
        $(document).keydown(XAC.keydown);
        $(document).keyup(XAC.keyup);
        $(document).mousedown(XAC.mousedown);

        XAC.on(XAC.SHIFT, function () {
            FORTE.shiftPressed = true;
        });

        XAC.on(XAC.CTRL, function () {
            FORTE.ctrlPressed = true;
        });

        XAC.on('S', function () {
            if (FORTE.ctrlPressed) {
                // FORTE.saveToImage(FORTE.focusedDesignLayer);
                FORTE.focusedDesignLayer.saveToImage();
            }
        });

        XAC.on(XAC.KEYUP, function () {
            FORTE.shiftPressed = false;
            FORTE.ctrlPressed = false;
        });

        XAC.on(XAC.MOUSEDOWN, function (e) {
            FORTE.notify('');
            $('#divMoreCtrl').hide();
            $('#btnMore').html(FORTE.HTMLCODETRIANGLEDOWN);
        });

        //  create and initialize different layers
        setTimeout(function () {
            //
            // layers of editing
            //
            FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORBLACK);
            FORTE.addInfoLayer(FORTE.designLayer);
            FORTE.emptyLayer = new FORTE.MaskCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORYELLOW);
            FORTE.eraserLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.BGCOLORCANVAS);
            FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORRED);
            FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORBLUE);

            $('#tdCanvas').css('background', FORTE.BGCOLORCANVAS);

            // show dimension info
            FORTE._lbBoundingWidth = $('<label class="ui-widget info-label" style="position:absolute;"></label>');
            $(document.body).append(FORTE._lbBoundingWidth);
            FORTE._lbBoundingHeight = $('<label class="ui-widget info-label" style="position:absolute;"></label>');
            $(document.body).append(FORTE._lbBoundingHeight);

            FORTE.layers = [FORTE.designLayer, FORTE.emptyLayer, FORTE.loadLayer, FORTE.boundaryLayer];
            FORTE.layer = FORTE.designLayer;
            FORTE.switchLayer(0);

            FORTE.customizeLoadLayer();
            FORTE.changeResolution();

            FORTE.optimizedLayers = [];

            //
            // layers of optimization
            //
            FORTE.htOptimizedLayers = {};
            FORTE.optimizationPanel = $('#divOptimizedPanel');
            var topMarginPanel = 5;
            var rightMarginPanel = 5;
            FORTE.optimizationPanel.width(FORTE.WIDTHOPTIMIZEDPANEL);
            var parentWidth = $('#tdCanvas').width();
            var parentWidth = $('#tdCanvas').width();
            var parentOffset = $('#tdCanvas').offset();
            FORTE.optimizationPanel.css('position', 'absolute');
            FORTE.optimizationPanel.css('top', parentOffset.top);
            FORTE.optimizationPanel.css('left', parentOffset.left + parentWidth - FORTE.WIDTHOPTIMIZEDPANEL - rightMarginPanel);
            $('#tdCanvas').append(FORTE.optimizationPanel);

            FORTE.optimizedLayerList = $('<ul></ul>');
            FORTE.optimizedLayerList.addClass('ui-widget');
            FORTE.optimizedLayerList.tagit({
                onTagClicked: function (e, ui) {
                    FORTE.showOptimizedLayer(ui.tag, ui.tagLabel);
                },
                beforeTagRemoved: function (e, ui) {
                    var layer = FORTE.htOptimizedLayers[ui.tagLabel];
                    if (layer != undefined) layer._canvas.remove();
                    FORTE.htOptimizedLayers[ui.tagLabel] = undefined;

                    FORTE.updateStressAcrossLayers(FORTE.toShowStress);
                }
            });
            FORTE.optimizationPanel.append(FORTE.optimizedLayerList);

            time('ready');

            if (FORTE.outputDir == undefined) {
                $('#divNotification').css('background', 'rgba(255, 0, 0, 0.75)');
                $('#divNotification').css('color', '#ffffff');
                $('#divNotification').html('optimization server unavailable.');
            } else {
                FORTE.notify('welcome to forte!');
            }

            // set info label visibility
            var opacityInfoLabel = FORTE.SHOWINFOLABELS ? FORTE.OPACITYDIMLABEL : 0;
            $('.info-label').css('opacity', opacityInfoLabel);

            // [debug] test stuff in the sandbox
            FORTE.sandbox();

            //
            // end of main table onload
            //
        }, 100);

    });
});

//
//  routine to reset radio button for each selection/deselection
//
FORTE.resetLayerButtons = function (idx) {
    // remove and re-add all the radio buttons 
    $('[name="' + FORTE.nameButtonsInputLayer + '"]').remove();
    $('[name="lb' + FORTE.nameButtonsInputLayer + '"]').remove();
    var imgSrcs = [FORTE.ICONDESIGN, FORTE.ICONVOID, FORTE.ICONLOAD, FORTE.ICONBOUNDARY];
    var labels = [];
    for (src of imgSrcs) labels.push('<img class="icon" src="' + src + '"></img>');
    FORTE.checkedBtnInputLayer = XAC.makeRadioButtons('ButtonsInputLayer', labels, [0, 1, 2, 3, 4],
        $('#tdInputLayers'), idx, false);
    $('[name="' + FORTE.nameButtonsInputLayer + '"]').on("click", function (e) {
        var checked = $(e.target).attr('checked');
        if (checked == 'checked') {
            FORTE.switchLayer(-1);
            FORTE.resetLayerButtons();
        } else {
            FORTE.switchLayer(parseInt($(e.target).val()));
            if (FORTE.checkedBtnInputLayer != undefined) FORTE.checkedBtnInputLayer.attr('checked', false);
            $(e.target).attr('checked', true);
            FORTE.checkedBtnInputLayer = $(e.target);
        }
    });

    // reset all corresponding layers
    if (FORTE.layers != undefined) FORTE.switchLayer(-1);
}

//
//  routines to reset radio button for switching between eraser and pencil
//
FORTE.resetEditModeButtons = function () {
    $('[name="' + FORTE.nameButtonsTools + '"]').remove();
    $('[name="lb' + FORTE.nameButtonsTools + '"]').remove();
    var imgSrcsTools = [FORTE.ICONDRAW, FORTE.ICONERASER];
    var labelsTools = [];
    FORTE.editMode = FORTE.DRAW;
    for (src of imgSrcsTools) labelsTools.push('<img class="icon" src="' + src + '"></img>');
    FORTE.checkedBtnTool = XAC.makeRadioButtons(FORTE.nameButtonsTools, labelsTools, [FORTE.DRAW, FORTE.ERASE],
        $('#tdTools'), FORTE.editMode, false);
    $('[name="' + FORTE.nameButtonsTools + '"]').on("click", function (e) {
        FORTE.editMode = parseInt($(e.target).val());
        for (layer of FORTE.layers) layer._toErase = FORTE.editMode;
    });
}

//
//  routine to only show selected optimized layer, given its label
//
FORTE.showOptimizedLayer = function (tag, label) {
    // un-select the recorded selected tag
    if (FORTE.selectedTag != undefined) {
        $(FORTE.selectedTag).removeClass('ui-state-highlight');
    }
    FORTE.focusedDesignLayer = undefined;

    // removed any currently displayed optimized layers
    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) {
        var layer = FORTE.htOptimizedLayers[key];
        if (layer != undefined) layer._canvas.remove();
    }

    // if it's the tag that's already selected, do not re-select it
    if (tag == undefined || FORTE.selectedTag != undefined && FORTE.selectedTag[0] == tag[0]) {
        FORTE.selectedTag = undefined;
        return;
    }

    // select the tag and show its associcated canvas
    var layer = FORTE.htOptimizedLayers[label];
    if (layer != undefined) {
        if (layer._needsUpdate) layer.forceRedraw(layer._heatmap);
        layer._parent.append(layer._canvas);
        FORTE.addEditingLayer(layer);

        // set to type
        $('#ddOptType option[value=' + layer.type + ']').prop('selected', true);

        // set to material ratio
        log('material: ' + layer._lastMaterialRatio);
        FORTE.updateSlider(FORTE.sldrMaterial, layer._lastMaterialRatio, function (valMat) {
            var value = (valMat - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
            return FORTE._getSliderValue(value);
        });

        // set to similarity ratio
        log('similarity: ' + layer._lastSimilarityRatio);
        FORTE.updateSlider(FORTE.sldrSimilarity, layer._lastSimilarityRatio, function (valMat) {
            var value = (valMat - FORTE.MINSIMILARITYRATIO) / (FORTE.MAXSIMILARITYRATIO - FORTE.MINSIMILARITYRATIO);
            return FORTE._getSliderValue(value);
        });

        FORTE.selectedTag = tag;
        $(FORTE.selectedTag).addClass('ui-state-highlight');
    } else {
        FORTE.selectedTag = undefined;
    }

    FORTE.focusedDesignLayer = layer;
}

//
//  render intermediate results
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
        FORTE.optimizedLayer.drawFromBitmap(bitmap,
            Math.max(FORTE.design.bbox.xmin - FORTE.design._margin, 0),
            Math.max(FORTE.design.bbox.ymin - FORTE.design._margin, 0));
        // FORTE.design.bbox.xmin, FORTE.design.bbox.ymin);
        FORTE.pointer++;

        setTimeout(function () {
            FORTE.render();
        }, FORTE.renderInterval);
    } else {
        if (FORTE.renderStarted) {
            FORTE.updateStressAcrossLayers(FORTE.toShowStress);
            log('rendering stopped.');
            FORTE.renderStarted = false;
            FORTE.notify('optimization finished ...');
            var keys = Object.keys(FORTE.htOptimizedLayers);
            for (key of keys) {
                var layer = FORTE.htOptimizedLayers[key];
                if (layer != undefined) layer.enable(1.0);
            }

            // freeze optimization to avoid accidential clicking twice
            FORTE.optFrozen = true;
            FORTE.notify('please wait ...');
            setTimeout(function () {
                FORTE.optFrozen = false;
                FORTE.notify('ready!');
            }, 2000);
        }
    }
}

//
//  start the optimization
//
FORTE.startOptimization = function () {
    if (FORTE.outputDir == undefined) {
        FORTE.notify('optimization server unavailable');
        return;
    }
    var type = $('#ddOptType :selected').val();

    FORTE.design.designPoints = FORTE.designLayer.package();
    FORTE.design.emptyPoints = FORTE.emptyLayer.package().points;
    // load points are recorded as soon as loads are created
    FORTE.design.boundaryPoints = FORTE.boundaryLayer.package();

    var dataObject = FORTE.design.getData();
    if (dataObject == undefined) {
        FORTE.notify('missing loads and/or boundary ...');
        return false;
    }

    FORTE.resolution = dataObject.resolution;

    var data = JSON.stringify(dataObject);
    FORTE.editWeightRatio = 0.3;
    var started = false;
    if (data != undefined) {
        var fields = ['trial', 'forte', 'material', 'similarity', 'editweight', 'type', 'e', 'nu'];
        FORTE.trial = 'forte_' + Date.now();
        var values = [FORTE.trial, data, FORTE.materialRatio,
            FORTE.similarityRatio, FORTE.editWeightRatio, type,
            1.0, FORTE.nu
        ];
        XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', fields, values);
        FORTE.state = 'started';

        // start profiling
        time();

        // clear pending timeouts
        for (id of FORTE.timeouts) clearTimeout(id);
        FORTE.timeouts = [];

        // start fetching data
        FORTE.fetchData();
        started = true;

        // reset stress read mark
        FORTE.stressRead = false;

        // update ui to indicate start of optimization
        $("body").css("cursor", "progress");
        FORTE.notify('optimization started ...');
        var keys = Object.keys(FORTE.htOptimizedLayers);
        for (key of keys) {
            var layer = FORTE.htOptimizedLayers[key];
            if (layer != undefined) layer.disable(1.0);
        }
        $('.info-label').hide();

        // set menu semitransparent to alert the users that optimization is running
        $('.tbmenu').css('opacity', '0.25');
        FORTE.setBackground();
    } else {
        FORTE.notify('problems for generating data ...');
    }

    return started;
}

//
//  finish the optimization
//
FORTE.finishOptimization = function () {
    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', ['stop'], ['true']);
    FORTE.state = 'finished';
    FORTE.resetButtonFromOptimization($('#btnOptCtrl'));

    $("body").css("cursor", "default");
    // FORTE.notify('optimization finished ...');
}

//
//  update stress visualization across layers
//
FORTE.updateStressAcrossLayers = function (toShow) {
    var layers = [];
    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) layers.push(FORTE.htOptimizedLayers[key]);
    var layerCurrent = FORTE.selectedTag == undefined ? undefined :
        FORTE.htOptimizedLayers[FORTE.selectedTag[0].innerText];
    for (layer of layers) {
        if (layer == undefined) continue;
        if (toShow) {
            // [exp] changed to yield stress
            // layer.updateHeatmap(FORTE.design.maxStress);
            log(FORTE.safety)
            layer.updateHeatmap(FORTE.yieldStress / FORTE.safety);
            if (layer == layerCurrent) layer.forceRedraw(layer._heatmap);
            layer._needsUpdate = true;
        } else {
            layer.forceRedraw();
        }
    }

}

//
//  get a value to assign to a slider, given preset range (raw value -> slider value)
//
FORTE._getSliderValue = function (value) {
    return FORTE.MINSLIDER * (1 - value) + FORTE.MAXSLIDER * value;
}

//
//  normalize value read from a slider (slider value -> normalized value -> raw value)
//
FORTE._normalizeSliderValue = function (slider, value) {
    var max = slider.slider("option", "max");
    var min = slider.slider("option", "min");
    return (value - min) * 1.0 / (max - min);
}

//
//  extending jquery to do pulsing for buttons
//
jQuery.fn.extend({
    pulse: function (color0, color1, period) {
        $(this).animate({
            backgroundColor: color0
        }, period);
        $(this).animate({
            backgroundColor: color1
        }, period, function () {
            if ($(this).attr('pulsing') == 'true') $(this).pulse(color0, color1, period);
            else {
                $(this).css('background-color', color0);
            }
        });
    }
});

//
//  set button for optimization (changes to 'finish', pulses, disables others, etc.)
//
FORTE.setButtonForOptimization = function (button) {
    button.attr('pulsing', true);
    // button.pulse(button.css('background-color'), FORTE.COLORBLUE, 1000);
    button.attr('bg-original', button.css('background-color'));
}

//
//  reset button from optimization (reset to original state)
//
FORTE.resetButtonFromOptimization = function (button) {
    // button.html(label);
    button.attr('src', FORTE.ICONRUN);
    button.stop();
    button.attr('pulsing', false);
    button.css('background-color', button.attr('bg-original'));
}

//
//  update slider by mapping the value to it using the mapFunc
//
FORTE.updateSlider = function (sldr, value, mapFunc) {
    var sldrValue = sldr.slider('option', 'value');
    value = mapFunc(value, sldr);
    if (sldrValue != value) sldr.slider('value', value);
}

//
//  show notification
//
FORTE.notify = function (msg, toFade) {
    if (msg == undefined) return;
    if (toFade != false && $('#divNotification').attr('isFading') == 'true') {
        FORTE.notifications.push([msg, toFade]);
        return;
    }

    // log(msg)
    $('#divNotification').html(msg);

    if (toFade == false) {
        $('#divNotification').stop();
        $('#divNotification').attr('isFading', false);
        $('#divNotification').fadeIn(5);
        return;
    }

    $('#divNotification').attr('isFading', true);
    $('#divNotification').fadeIn(500, function () {
        $('#divNotification').fadeOut(1500, function () {
            $('#divNotification').attr('isFading', false);
            var params = FORTE.notifications.pop();
            if (params == undefined) return;
            FORTE.notify(params[0], params[1]);
        });
    });
}

//
//  map length of an load arrow to weight
//
FORTE.mapToWeight = function (length) {
    var gainRatio = 0.001;
    return Math.pow(length, 3) * FORTE.newtonPerPixel / 9.8 * gainRatio;
}

//
//  map a unit-less stress to units
//
FORTE.mapToUnits = function (stress) {
    var N = FORTE.mapToWeight(1) * 9.8; // assuming only 1 of FORTE.numElmsThickness
    var mm = Math.pow(FORTE.lengthPerPixel * FORTE.designLayer._cellSize, 2);
    return stress * FORTE.e * N / mm;
}

//
//  set background image from file
//
FORTE.setBackground = function(filename) {
    var urlImg = 'design_data/' + filename;
    $('#tdCanvas').css('background-image', 'url(' + urlImg + ')');
}
// .....................................................................................................
//
//  forte, v0.2
//
//  by xiangchen@acm.org, 07/2017
//
// .....................................................................................................

var FORTE = FORTE || {};

//
//  the ready function, mostly for ui
//
$(document).ready(function () {
    time();

    // manage timeouts
    FORTE.timeouts = [];

    // client-server setup
    FORTE.xmlhttp = new XMLHttpRequest();
    FORTE.xmlhttp.timeout = 1e9;
    FORTE.xmlhttp.onreadystatechange = function () {
        if (FORTE.xmlhttp.readyState == 4 && FORTE.xmlhttp.status == 200) {
            log('server response: ' + FORTE.xmlhttp.responseText);
            var outDir = XAC.getParameterByName('outdir', FORTE.xmlhttp.responseText);
            if (outDir != null && outDir != undefined) {
                FORTE.outputDir = outDir;
                log('server output directory: ' + FORTE.outputDir);
            }
        }
    }
    // initial ping to get the output directory
    XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', [], []);

    // enable drag and drop
    XAC.enableDragDrop(function (files) {
        if (files.length <= 0) return;
        var reader = new FileReader();
        if (files[0].name.endsWith('forte')) reader.onload = FORTE.loadForteFile;
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
        });

        // material amount slider
        FORTE.materialRatio = FORTE.INITMATERIALRATIO;
        var ratio = (FORTE.materialRatio - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        $('#tdMaterial').width(FORTE.WIDTHMATERIALSLIDER);
        FORTE.sldrMaterial = XAC.makeSlider('sldrMaterial', 'material',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdMaterial'));
        FORTE.sldrMaterial.slider({
            change: function (e, ui) {
                var value = FORTE._normalizeSliderValue($(e.target), ui.value);
                FORTE.materialRatio = FORTE.MINMATERIALRATIO * (1 - value) + FORTE.MAXMATERIALRATIO * value;
            }
        })

        // brushes for design, load and boundary
        FORTE.nameBrushButtons = 'brushButtons';
        FORTE.resetRadioButtons(0);

        // eraser
        $('#btnErase').attr('src', FORTE.ICONERASER);
        $('#btnErase').button();
        $('#btnErase').click(function (e) {
            $(this).toggleClass('ui-state-active');
            for (layer of FORTE.layers) layer._toErase = !layer._toErase;
        });

        //  similarity slider
        FORTE.similarityRatio = 5;
        var ratio = (FORTE.similarityRatio - FORTE.MINSIMILARITYRATIO) /
            (FORTE.MAXSIMILARITYRATIO - FORTE.MINSIMILARITYRATIO);
        var valueSlider = FORTE._getSliderValue(ratio);
        $('#tdSimilarity').width('180px');
        FORTE.sldrSimilarity = XAC.makeSlider('sldrSimilarity', 'similarity',
            FORTE.MINSLIDER, FORTE.MAXSLIDER, valueSlider, $('#tdSimilarity'));
        FORTE.sldrSimilarity.slider({
            change: function (e, ui) {
                var value = FORTE._normalizeSliderValue($(e.target), ui.value);
                FORTE.similarityRatio = FORTE.MINSIMILARITYRATIO * (1 - value) +
                    FORTE.MAXSIMILARITYRATIO * value;
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
                if (FORTE.startOptimization()) {
                    FORTE.resetRadioButtons();
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

        // save
        $('#btnSave').attr('src', FORTE.ICONSAVE);
        $('#btnSave').button();
        $('#btnSave').click(function (e) {
            FORTE.saveForteToFile();
        });

        // more controls
        $('#btnMore').html(FORTE.HTMLCODETRIANGLEDOWN);
        $('#btnMore').css('font-size', 'x-small');
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

        $('#divMoreCtrl').css('background-color', FORTE.BGCOLORCANVAS); //'rgba(255, 255, 255, 0.75)');
        $('#divMoreCtrl').css('z-index', ++FORTE.MAXZINDEX);
        $('#divMoreCtrl').css('position', 'absolute');
        var _parentOffset = $('#tdCanvas').offset();
        $('#divMoreCtrl').css('left', _parentOffset.left);
        $('#divMoreCtrl').css('top', _parentOffset.top);
        $('#divMoreCtrl').hide();

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

        setTimeout(function () {
            //
            // layers of editing
            //
            FORTE.designLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORBLACK);
            FORTE.emptyLayer = new FORTE.MaskCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORYELLOW);
            // FORTE.lessMaterialLayer = new FORTE.MaskCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORYELLOW);
            FORTE.eraserLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.BGCOLORCANVAS);
            FORTE.loadLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORRED);
            FORTE.boundaryLayer = new FORTE.GridCanvas($('#tdCanvas'), FORTE.width, FORTE.height, FORTE.COLORBLUE);

            $('#tdCanvas').css('background', FORTE.BGCOLORCANVAS);

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

                    FORTE.design.maxStress = 0;
                    var keys = Object.keys(FORTE.htOptimizedLayers);
                    for (key of keys) {
                        var layer2 = FORTE.htOptimizedLayers[key];
                        if (layer2 != undefined && layer2 != layer && layer2._stressInfo != undefined) {
                            FORTE.design.maxStress =
                                Math.max(FORTE.design.maxStress, layer2._stressInfo.maxStress);
                        }
                    }

                    FORTE.updateStressAcrossLayers(FORTE.toShowStress);
                }
            });
            FORTE.optimizationPanel.append(FORTE.optimizedLayerList);

            // [debug] test stuff in the sandbox
            FORTE.sandbox();

            time('ready');
        }, 100);
    });
});

//
//  routine to reset radio button for each selection/deselection
//
FORTE.resetRadioButtons = function (idx) {
    // remove and re-add all the radio buttons 
    $('[name="' + FORTE.nameBrushButtons + '"]').remove();
    $('[name="lb' + FORTE.nameBrushButtons + '"]').remove();
    var imgSrcs = [FORTE.ICONDESIGN, FORTE.ICONVOID, FORTE.ICONLOAD, FORTE.ICONBOUNDARY];
    var labels = [];
    for (src of imgSrcs) labels.push('<img class="icon" src="' + src + '"></img>');
    FORTE.checkedButton = XAC.makeRadioButtons('brushButtons', labels, [0, 1, 2, 3, 4],
        $('#tdBrushes'), idx, false);
    $('[name="' + FORTE.nameBrushButtons + '"]').on("click", function (e) {
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

    // reset all corresponding layers
    if (FORTE.layers != undefined) FORTE.switchLayer(-1);
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
    if (FORTE.selectedTag != undefined && FORTE.selectedTag[0] == tag[0]) {
        FORTE.selectedTag = undefined;
        return;
    }

    // select the tag and show its associcated canvas
    var layer = FORTE.htOptimizedLayers[label];
    if (layer != undefined) {
        if (layer._needsUpdate) layer.forceRedraw(layer._heatmap);
        layer._parent.append(layer._canvas);
        FORTE.addEraser(layer);
        
        // set to mode
        if(layer.mode == FORTE.GETVARIATION) $('#rbGetVariation')[0].checked = true;
        else if(layer.mode == FORTE.ADDSTRUCTS) $('#rbAddStructs')[0].checked = true;
        
        // set to material ratio
        XAC.updateSlider(FORTE.sldrMaterial, layer._lastMaterialRatio, function (valMat) {
            var value = (valMat - FORTE.MINMATERIALRATIO) / (FORTE.MAXMATERIALRATIO - FORTE.MINMATERIALRATIO);
            return FORTE._getSliderValue(value);
        });

        // set to similarity ratio
        XAC.updateSlider(FORTE.sldrSimilarity, layer._lastSimilarityRatio, function (valMat) {
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
        FORTE.optimizedLayer.drawFromBitmap(bitmap, FORTE.design.bbox.xmin, FORTE.design.bbox.ymin);
        FORTE.pointer++;

        setTimeout(function () {
            FORTE.render();
        }, FORTE.renderInterval);
    } else {
        if (FORTE.renderStarted) {
            FORTE.updateStressAcrossLayers(FORTE.toShowStress);
            log('rendering stopped.');
        }
    }
}

//
//  start the optimization
//
FORTE.startOptimization = function () {
    var mode;
    if ($('#rbGetVariation')[0].checked) mode = FORTE.GETVARIATION;
    else if ($('#rbAddStructs')[0].checked) mode = FORTE.ADDSTRUCTS;

    FORTE.design.designPoints = FORTE.designLayer.package();
    FORTE.design.emptyPoints = FORTE.emptyLayer.package().points;
    // load points are recorded as soon as loads are created
    FORTE.design.boundaryPoints = FORTE.boundaryLayer.package();

    var dataObject = FORTE.design.getData();
    if (dataObject == undefined) return false;

    FORTE.resolution = dataObject.resolution;

    var data = JSON.stringify(dataObject);
    var started = false;
    if (data != undefined) {
        var fields = ['trial', 'forte', 'material', 'similarity', 'mode'];
        FORTE.trial = 'forte_' + Date.now();
        var values = [FORTE.trial, data, FORTE.materialRatio, FORTE.similarityRatio, mode];
        XAC.pingServer(FORTE.xmlhttp, 'localhost', '1234', fields, values);
        FORTE.state = 'started';
        time();
        for (id of FORTE.timeouts) clearTimeout(id);
        FORTE.timeouts = [];
        FORTE.fetchData();
        started = true;
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
}

//
//  update stress visualization across layers
//
FORTE.updateStressAcrossLayers = function (toShow) {
    var layers = [];
    var keys = Object.keys(FORTE.htOptimizedLayers);
    for (key of keys) layers.push(FORTE.htOptimizedLayers[key]);
    var layerCurrent = FORTE.htOptimizedLayers[FORTE.selectedTag[0].innerText];
    for (layer of layers) {
        if (layer == undefined) continue;
        if (toShow) {
            layer.updateHeatmap(FORTE.design.maxStress);
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
    // button.html('finish');
    button.attr('pulsing', true);
    button.pulse(button.css('background-color'), FORTE.COLORBLUE, 1000);
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
//
//
XAC.updateSlider = function (sldr, value, mapFunc) {
    var sldrValue = sldr.slider('option', 'value');
    value = mapFunc(value, sldr);
    if (sldrValue != value) sldr.slider('value', value);
}
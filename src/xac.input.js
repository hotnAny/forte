// ........................................................................................................
//
//  handling different object-oriented input techniques by dispatching input events to them
//
//  [forte version]
//
//  by xiangchen@acm.org, v1.0f, 10/2017
//
// ........................................................................................................

var XAC = XAC || {};

// mouse events
XAC.MOUSEDOWN = -1;
XAC.MOUSEMOVE = -2;
XAC.MOUSEUP = -3;
XAC.MOUSEWHEEL = -4;
XAC.KEYUP = -5;

XAC.LEFTMOUSE = 1;
XAC.RIGHTMOUSE = 2;
XAC.WHEEL = 4;

// keyboard events
XAC.LEFTARROW = 37;
XAC.UPARROW = 38;
XAC.RIGHTARROW = 39;
XAC.DOWNARROW = 40;
XAC.ENTER = 13;
XAC.SHIFT = 16;
XAC.CMD = 91;
XAC.CTRL = 17;
XAC.DELETE = 46;
XAC.ESC = 27;

XAC._activeHits = [];
XAC.keydowns = {};

XAC._selecteds = [];
XAC.mousedownEventHandlers = {};

//
//  [internal helper] compute mouse footprint since last mousedown
//
XAC._updateFootprint = function (x, y) {
    if (x == undefined || y == undefined) {
        XAC._prevCooord = undefined;
        return;
    }

    if (XAC._prevCooord == undefined) {
        XAC._footprint = 0;
    } else {
        XAC._footprint += Math.sqrt(
            Math.pow(x - XAC._prevCooord[0], 2) +
            Math.pow(y - XAC._prevCooord[1], 2));
    }

    XAC._prevCooord = [x, y];
}

XAC.mousedown = function (e) {
    /////////////////////////////////////////////////////////
    // modify for project forte
    if (e.target.nodeName != 'CANVAS') return;

    // XAC._updateFootprint();
    // XAC._dispatchInputEvents(e, XAC.MOUSEDOWN);

    if (XAC.mousedowns != undefined) {
        for (handler of XAC.mousedowns) handler(e);
    }
    /////////////////////////////////////////////////////////
};

XAC.mousemove = function (e) {
    XAC._updateFootprint(e.clientX, e.clientY);
    XAC._dispatchInputEvents(e, XAC.MOUSEMOVE);
};

XAC.mouseup = function (e) {
    XAC._updateFootprint(e.clientX, e.clientY);
    XAC._dispatchInputEvents(e, XAC.MOUSEUP);

    /////////////////////////////////////////////////////////
    // modify for project forte
    if (XAC.mouseups != undefined) {
        for (handler of XAC.mouseups) handler(e);
    }
    /////////////////////////////////////////////////////////
};

XAC.mousewheel = function (e) {
    XAC._dispatchInputEvents(e, XAC.MOUSEWHEEL);

    /////////////////////////////////////////////////////////
    // modify for project forte
    if (XAC.mousewheels != undefined) {
        for (handler of XAC.mousewheels) handler(e);
    }
    /////////////////////////////////////////////////////////
}

XAC.keydown = function (e) {
    XAC._dispatchInputEvents(e, XAC.KEYDOWN);
    if (XAC.keydowns != undefined) {
        (XAC.keydowns[e.keyCode] || console.error)();
    }
}

XAC.keyup = function (e) {
    if (XAC.keyups != undefined) {
        for (handler of XAC.keyups) {
            handler(e);
        }
    }
}

XAC.on = function (cue, handler) {
    switch (cue) {
        case XAC.MOUSEDOWN:
            XAC.mousedowns = XAC.mousedowns || [];
            XAC.mousedowns.push(handler);
            // TODO:
            break;
        case XAC.MOUSEMOVE:
            // TODO
            break;
        case XAC.MOUSEUP:
            XAC.mouseups = XAC.mouseups || [];
            XAC.mouseups.push(handler);
            break;
        case XAC.MOUSEWHEEL:
            XAC.mousewheels = XAC.mousewheels || [];
            XAC.mousewheels.push(handler);
            break;
        case XAC.KEYUP:
            XAC.keyups = XAC.keyups || [];
            XAC.keyups.push(handler);
            break;
        default:
            XAC.keydowns = XAC.keydowns || {};
            if (typeof (cue) == 'string') {
                var key = cue.charCodeAt(0);
                XAC.keydowns[key] = handler;
            } else {
                XAC.keydowns[cue] = handler;
            }
            break;
    }
}

XAC._dispatchInputEvents = function (e, type) {
    if (type == XAC.MOUSEDOWN) {
        XAC._activeHits = rayCast(e.clientX, e.clientY, XAC.objects);
    }

    // select or de-select objects
    switch (type) {
        case XAC.MOUSEUP:
            var tempSelecteds = XAC._selecteds.clone();
            for (object of tempSelecteds) {
                if (e.which == LEFTMOUSE && XAC._footprint < 50) {
                    if (object._selectable) {
                        if (object._selected && !e.shiftKey) {
                            if (object._onDeselected) object._onDeselected();
                            XAC._selecteds.remove(object);
                            object._selected = false;
                        } else {
                            if (object._onSelected) object._onSelected();
                            object._selected = true;
                        }
                    }
                }
            }
            break;
    }

    // objects currently being manipulated
    for (hit of XAC._activeHits) {
        // attached handlers
        switch (type) {
            case XAC.MOUSEDOWN:
                if (hit.object.mousedowns != undefined) {
                    for (mousedown of hit.object.mousedowns) {
                        mousedown(hit);
                    }
                }

                // only take the first hit - avoid selecting multiple objects in one click
                var hitObject = hit.object.object3d || hit.object;
                if (XAC._selecteds.indexOf(hitObject) < 0)
                    XAC._selecteds.push(hitObject);

                break;
            case XAC.MOUSEMOVE:
                // TODO for mousemoves
                break;
            case XAC.MOUSEUP:
                // TODO
                break;
            case XAC.MOUSEWHEEL:
                // TODO
                break;
            case XAC.KEYDOWN:
                if (hit.object.keydowns != undefined) {
                    (hit.object.keydowns[e.keyCode] || console.error)();
                }
                break;
        }

        // input techniques
        if (hit.object.inputTechniques != undefined) {
            for (technique of hit.object.inputTechniques) {
                switch (type) {
                    case XAC.MOUSEDOWN:
                        if (technique.mousedown(e, hit) == false) {
                            XAC._activeHits.remove(hit);
                        }
                        break;
                    case XAC.MOUSEMOVE:
                        technique.mousemove(e, hit);
                        break;
                    case XAC.MOUSEUP:
                        technique.mouseup(e, hit);
                        XAC._activeHits.remove(hit);
                        break;
                    case XAC.MOUSEWHEEL:
                        if (technique.mousewheel != undefined) technique.mousewheel(e, hit);
                        break;
                }
            }
        }
    }
}

//
//  enable drag & drop on the entire app
//
XAC.enableDragDrop = function (filesHandler) {
    // drag & drop 3d model file
    $(document).on('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        e.dataTransfer.dropEffect = 'copy';
    });

    $(document).on('drop', function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        var files = e.dataTransfer.files;

        if (filesHandler != undefined) {
            filesHandler(files);
        }
    });
}

//
//  make sliders
//  -   hack: will generate a label with an id of "lb<id>"
//
XAC.makeSlider = function (id, label, min, max, value, parent, width) {
    var tr = $('<tr></tr>');
    tr.append($('<td><label id="lb' + id + '" class="ui-widget">' + label + '&nbsp;&nbsp;' + '</label></td>'));
    var tdSldr = $('<td width="' + width + '"></td>');
    var sldr = $('<div id="' + id + '"></div>');
    tdSldr.append(sldr);
    tr.append(tdSldr);

    sldr.slider({
        max: max,
        min: min,
        range: 'max'
    });

    sldr.slider('value', value);

    parent.append(tr);
    sldr.row = tr;
    return sldr;

}

//
//  make radio buttons
//
XAC.makeRadioButtons = function (name, labels, values, parent, idxChecked, hasIcon) {
    var checkedInput;
    var id = (Math.random() * 1000 | 0).toString();
    for (var i = 0; i < labels.length; i++) {
        // 
        var label = $('<label for="input' + id + i + '" name="lb' + name + '">' + labels[i] + '</label>');
        var input = $('<input type="radio" name="' + name + '" value="' + values[i] +
            '" id="input' + id + i + '">');
        if (i == idxChecked) {
            input.attr('checked', true);
            checkedInput = input;
        }
        parent.append(label);
        parent.append(input);
    }
    $('[name="' + name + '"]').checkboxradio({
        icon: hasIcon
    });

    return $(checkedInput);
}
// ......................................................................................................
//
//  a class of forte design
//
//  by xiangchen@acm.org, v0.0, 05/2017
//
// ......................................................................................................

FORTE.Design = function (width, height) {
    this.width = width;
    this.height = height;
    this.designPoints = [];
    this.emptyPoints = [];
    this.loadPoints = [];
    this.loadValues = [];
    this.boundaryPoints = [];
};

FORTE.Design.prototype = {
    constructor: FORTE.Design
}

FORTE.Design.prototype.getData = function () {
    if(this.loadPoints.length <= 0 || this.boundaryPoints.length <= 0) return;

    // find bounding box
    var bbox = {
        xmin: this.width,
        xmax: 0,
        ymin: this.height,
        ymax: 0
    };

    var __updateBbox = function (p, bbox) {
        bbox.xmin = Math.min(p[0], bbox.xmin);
        bbox.xmax = Math.max(p[0], bbox.xmax);
        bbox.ymin = Math.min(p[1], bbox.ymin);
        bbox.ymax = Math.max(p[1], bbox.ymax);
    }

    var __updatePoint = function (p, bbox) {
        p[0] -= bbox.xmin;
        p[1] -= bbox.ymin;
        return p;
    }

    for (p of this.designPoints) __updateBbox(p, bbox);
    // for (p of this.emptyPoints) __updateBbox(p, bbox);
    for (lps of this.loadPoints)
        for (p of lps) __updateBbox(p, bbox);
    for (p of this.boundaryPoints) __updateBbox(p, bbox);

    // log(bbox)
    var margin = 2;
    bbox.xmin = Math.max(bbox.xmin - margin, 0);
    bbox.xmax = Math.min(bbox.xmax + margin, this.width);
    bbox.ymin = Math.max(bbox.ymin - margin, 0);
    bbox.ymax = Math.min(bbox.ymax + margin, this.height);

    var width = bbox.xmax - bbox.xmin;
    var height = bbox.ymax - bbox.ymin;

    var designPoints = [];
    for (p of this.designPoints) designPoints.push(__updatePoint(p.clone(), bbox));
    var emptyPoints = [];
    for (p of this.emptyPoints) emptyPoints.push(__updatePoint(p.clone(), bbox));
    var loadPoints = [];
    for (lps of this.loadPoints)
        for (p of lps) loadPoints.push(__updatePoint(p.clone(), bbox));
    var loadValues = [];
    for(lvs of this.loadValues)
        for(v of lvs) loadValues.push(v);
    var boundaryPoints = [];
    for (p of this.boundaryPoints) boundaryPoints.push(__updatePoint(p.clone(), bbox));

    // [debug]
    // var arr = XAC.initMDArray([height, width], ' ');
    // for (p of designPoints) arr[p[1]][p[0]] = 'O'
    // for (p of emptyPoints) arr[p[1]][p[0]] = 'X'
    // for (p of loadPoints) arr[p[1]][p[0]] = '*';
    // for (p of boundaryPoints) arr[p[1]][p[0]] = '#'

    // var str = ''
    // for (row of arr)
    //     str += row.toString() + '\n'
    // for(elm of row)
    //     str += elm;
    // str += '\n'
    // log(str)

    FORTE.bbox = bbox;

    return {
        resolution: [width, height],
        design: designPoints,
        emptiness: emptyPoints,
        loadpoints: loadPoints,
        loadvalues: loadValues,
        boundaries: boundaryPoints
    };
}
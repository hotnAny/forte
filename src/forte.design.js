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
    return {
        resolution: [this.width, this.height],
        design: this.designPoints,
        emptiness: this.emptyPoints,
        loadpoints: this.loadPoints,
        loadvalues: this.loadValues,
        boundaries: this.boundaryPoints
    };
}
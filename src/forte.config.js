// ......................................................................................................
//
//  configuration, v1.0
//
//  by xiangchen@acm.org, 10/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

//
// topology optimization related
//
FORTE.P = 3;
// FORTE.MAXITERATIONS = 50; // fix this

// similarity
FORTE.INITMATERIALRATIO = 1;
FORTE.MATSLDRPOWERRATIO = 0.75; // make the material slider more even < or > 1
FORTE.MINMATERIALRATIO = 0.1;

// material
FORTE.MAXMATERIALRATIO = 3;
FORTE.MINSIMILARITYRATIO = 0;
FORTE.MAXSIMILARITYRATIO = 10;

// suggestive editing
FORTE.DRAW = 0;
FORTE.ERASE = 1;
FORTE.MINEDITWEIGHTRATIO = 0;
FORTE.MAXEDITWEIGHTRATIO = 8;

// scale (length per pixel)
FORTE.INITLENGTHPERPIXEL = 2; // mm
FORTE.MAXLENGTHPERPIXEL = 4;
FORTE.MINLENGTHPERPIXEL = 0.1;

// safety
FORTE.MINSAFETY = 1;
FORTE.MAXSAFETY = 1024;

// type of optimization
FORTE.ADDSTRUCTS = 0;
FORTE.GETVARIATION = 1;
FORTE.OPTIMIZEWITHIN = 2;

FORTE.THRESDENSITY = 0.01;  //  min non-ignorable element density

//
// control ui related
//
FORTE.WIDTHDEFAULT = 480;
FORTE.HEIGHTDEFAULT = 320;

FORTE.DIRDESIGNDATA = 'design_data';    // all .forte files are put here

// icons
FORTE.ICONNEW = 'assets/new.svg';
FORTE.ICONDESIGN = 'assets/design.svg';
FORTE.ICONVOID = 'assets/void.svg';
FORTE.ICONLOAD = 'assets/load2.svg';
FORTE.ICONBOUNDARY = 'assets/boundary2.svg';
FORTE.ICONDRAW = 'assets/draw.svg';
FORTE.ICONERASER = 'assets/eraser.svg';
FORTE.ICONSAVE = 'assets/save.svg';
FORTE.ICONEYE = 'assets/eye.svg';
FORTE.ICONRUN = 'assets/run.svg';
FORTE.ICONSTOP = 'assets/stop.svg';

// sliders
FORTE.MINSLIDER = 0;
FORTE.MAXSLIDER = 100;
FORTE.WIDTHMATERIALSLIDER = '100px';
FORTE.WIDTHSIMILARITYSLIDER = '100px';
FORTE.WIDTHEDITWEIGHTSLIDER = '50px';
FORTE.WIDTHMEASUREMENTSLIDER = '100px';
FORTE.WIDTHTHICKNESSSLIDER = '100px';
FORTE.WIDTHSAFETYSLIDER = '100px';

// unicodes
FORTE.HTMLCODENEWDESIGN = '&#128459;';
FORTE.HTMLCODETRIANGLEDOWN = '&#9660;';
FORTE.HTMLCODETRIANGLEUP = '&#9650;';

// colors
FORTE.COLORBLACK = '#333745'; //'#000000';
FORTE.COLORRED = '#EA2E49'; //'#cc0000';
FORTE.COLORYELLOW = '#F6F792'; //'#fffa90';
FORTE.COLORBLUE = '#77C4D3'; //'#00afff';
FORTE.COLOROPTLAYER = '#666666';
FORTE.BGCOLORCANVAS = '#f0f0f0';
FORTE.COLORERASER = 'rgba(255,255,255,0.5)';

// ui template
FORTE.MAINTABLETEMPLATE = 'assets/main_table.html';
FORTE.MINALPHAFORANIMATION = 0.33;
FORTE.PSEUDOMAXALPHA = 0.5;

// data streaming
FORTE.FETCHINTERVAL = 200;
FORTE.RENDERINTERVAL = 100;
FORTE.GIVEUPTHRESHOLD = 12;
FORTE.DELAYEDSTART = 3; // # of frames

// ui/layout
FORTE.WIDTHOPTIMIZEDPANEL = 96;
// FORTE.LABELGETVARIATION = 'get variation';
// FORTE.LABELADDSTRUCTS = 'add structures';
FORTE.MAXZINDEX = 100;

// info labels
FORTE.OPACITYDIMLABEL = 0.5;
FORTE.SHOWINFOLABELS = true;

FORTE.MAXNUMREADSTRESS = 8; // max # of times trying to read stress data (sometimes i/o could be slow)
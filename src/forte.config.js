// ......................................................................................................
//
//  configuration, v0.0
//
//  by xiangchen@acm.org, 06/2017
//
// ......................................................................................................

var FORTE = FORTE || {};

// topology optimization related
FORTE.P = 3;
FORTE.MAXITERATIONS = 50;   // fix this
FORTE.MINMATERIALRATIO = 0.5;
FORTE.MAXMATERIALRATIO = 5.0;
FORTE.MINSIMILARITYRATIO = 0;
FORTE.MAXSIMILARITYRATIO = 10;

// control ui related
FORTE.WIDTHDEFAULT = 240;
FORTE.HEIGHTDEFAULT = 160;

FORTE.ICONNEW = 'assets/new.svg';
FORTE.ICONDESIGN = 'assets/design.svg';
FORTE.ICONVOID = 'assets/void.svg';
FORTE.ICONLOAD = 'assets/load.svg';
FORTE.ICONBOUNDARY = 'assets/boundary.svg';
FORTE.ICONERASER = 'assets/eraser.svg';
FORTE.ICONSAVE = 'assets/save.svg';

FORTE.MINSLIDER = 0;
FORTE.MAXSLIDER = 100;
FORTE.WIDTHMATERIALSLIDER = '180px';

FORTE.HTMLCODENEWDESIGN = '&#128459;';
FORTE.HTMLCODETRIANGLEDOWN = '&#9660;';
FORTE.HTMLCODETRIANGLEUP = '&#9650;';

FORTE.MAINTABLETEMPLATE = 'assets/main_table.html';
FORTE.MINALPHAFORANIMATION = 0.33;
FORTE.PSEUDOMAXALPHA = 0.01;

FORTE.FETCHINTERVAL = 200;
FORTE.RENDERINTERVAL = 60;

FORTE.GIVEUPTHRESHOLD = 3;
FORTE.DELAYEDSTART = 1;

FORTE.WIDTHOPTIMIZEDPANEL = 96;

FORTE.LABELGETVARIATION = 'get variation';
FORTE.LABELADDSTRUCTS = 'add structs';

// canvas ui related
FORTE.BGCOLORCANVAS = '#f0f0f0';
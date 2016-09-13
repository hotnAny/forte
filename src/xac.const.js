var XAC = XAC || {};

XAC.Const = {};

XAC.EPSILON = 1e-6;
XAC.INFINITY = 1e9;

// some common visual properties
XAC.COLORNORMAL = 0xDB5B8A; // the normal color
XAC.COLORCONTRAST = 0xD1D6E7; // is the contrast of the COLORNORMAL
XAC.COLORHIGHLIGHT = 0xfffa90;
XAC.COLORFOCUS = 0xE82C0C; // color to really draw users' focus
XAC.COLORALT = 0x222222;

XAC.BACKGROUNDCOLOR = 0xF2F0F0;
XAC.GROUNDCOLOR = 0xF2F0F0;
XAC.GRIDCOLOR = 0xdddddd;

XAC.MATERIALNORMAL = new THREE.MeshPhongMaterial({
    color: XAC.COLORNORMAL,
    transparent: true,
    opacity: 0.75
});

XAC.MATERIALCONTRAST = new THREE.MeshBasicMaterial({
    color: XAC.COLORCONTRAST,
    transparent: true,
    opacity: 0.75
});

XAC.MATERIALHIGHLIGHT = new THREE.MeshPhongMaterial({
    color: XAC.COLORHIGHLIGHT,
    transparent: true,
    opacity: 0.95
});

XAC.MATERIALINVISIBLE = new THREE.MeshBasicMaterial({
    vertexColors: 0xffffff,
    transparent: true,
    visible: false
});

XAC.MATERIALPLAIN = new THREE.MeshBasicMaterial({
    vertexColors: 0xffffff,
    transparent: true,
    opacity: 0.75
});

XAC.MATERIALFOCUS = new THREE.MeshPhongMaterial({
    color: XAC.COLORFOCUS,
    transparent: true,
    opacity: 0.95
});

XAC.MATERIALALT = new THREE.MeshBasicMaterial({
    color: XAC.COLORALT,
    transparent: true,
    opacity: 0.75
});

XAC.MATERIALWIRE = new THREE.MeshBasicMaterial({
    color: XAC.COLORALT,
    transparent: true,
    wireframe: true,
    opacity: 0.75
});

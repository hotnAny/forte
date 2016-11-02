/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	a collection of routines to render ui elements
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

//
//  render all ui elements
//
FORTE.renderUI = function() {
    // HACK: ui dimensions
    // var aspectRatio = 0.9; // h to w
    var widthWindow = window.innerWidth;// * 0.99;
    var heightWindow = window.innerHeight;// * 0.99;

    var tblLayout = $('<table></table>');
    tblLayout.css('max-height', heightWindow);
    var trLayout = $('<tr></tr>');
    tblLayout.append(trLayout);

    //
    //  set up main canvas
    //
    // FORTE.tdCanvas = $('<td></td>');
    var widthCanvas = widthWindow; // * 0.7; // - widthOptView;
    var heightCanvas = heightWindow;
    canvasRenderSet = FORTE.createRenderableScene(widthCanvas, heightCanvas);
    FORTE.canvasRenderer = canvasRenderSet.renderer;
    FORTE.canvasScene = canvasRenderSet.scene;
    FORTE.canvasCamera = canvasRenderSet.camera;
    FORTE.ground = canvasRenderSet.ground;
    FORTE.camCtrl = new THREE.TrackballControls(FORTE.canvasCamera, undefined,
        undefined);
    // FORTE.camCtrl.noZoom = true;

    // for loading existing design onto main canvas
    // FORTE.tdCanvas.on('dragover', function(e) {
    //     e.stopPropagation();
    //     e.preventDefault();
    //     e.dataTransfer = e.originalEvent.dataTransfer;
    //     e.dataTransfer.dropEffect = 'copy';
    // });

    $(document.body).on('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        var files = e.dataTransfer.files;

        for (var i = files.length - 1; i >= 0; i--) {
            var reader = new FileReader();
            if (files[i].name.endsWith('forte')) {
                log('loading original design')
                reader.onload = (function(e) {
                    FORTE.designObj = JSON.parse(e.target.result);
                    FORTE.design._medialAxis.updateFromRawData(FORTE.designObj.design);
                    FORTE.centerCamera(FORTE.camCtrl, FORTE.designObj.design);
                });
            } else if (files[i].name.endsWith('vxg')) {
                reader.onload = (function(e) {
                    FORTE.voxelGrid = new FORTE.VoxelGrid(FORTE.canvasScene);
                    FORTE.voxelGrid.load(e.target.result, 2);
                    FORTE.voxelGrid.render();
                    // FORTE.voxelGrid.renderContour();
                    FORTE.voxelGrid.saveAs('forte.stl');
                });
            }
            reader.readAsBinaryString(files[i]);
        }
    });

    // FORTE.tdCanvas.append(FORTE.canvasRenderer.domElement);
    //
    // // add a selection frame
    // FORTE.tdCanvas.append($('<div id="selection" class="selectiondiv"></div>'));
    //
    // trLayout.append(FORTE.tdCanvas);

    return FORTE.canvasRenderer.domElement;
}

//
//  routines for creating a scene
//
FORTE.createRenderableScene = function(w, h) {
    var renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(w, h);
    renderer.setClearColor(XAC.BACKGROUNDCOLOR);

    var camera = new THREE.PerspectiveCamera(60, w / h, 1, 10000);
    camera.position.copy(new THREE.Vector3(0, 0, 200));
    var scene = new THREE.Scene();

    // lights
    var lights = [];
    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[0].position.set(0, 100, -100);
    lights[0].castShadow = true;
    lights[0].position.copy(camera.position);
    scene.add(lights[0]);

    // NOTE remove ground for better visibility
    // // ground
    // var ground = new THREE.Mesh(
    //     new THREE.CubeGeometry(1000, 1, 1000),
    //     XAC.MATERIALFOCUS
    // );
    // scene.add(ground);
    //
    // ground.position.y -= 0.5;

    // grid
    var lineMaterial = new THREE.LineBasicMaterial({
        color: XAC.GRIDCOLOR
    });
    var lineGeometry = new THREE.Geometry();
    var floor = -0.5;
    var ylength = 1000;
    var xlength = XAC.float2int(ylength * window.innerWidth / window.innerHeight);
    var step = 25;
    xlength = XAC.float2int(xlength / step) * step;

    for (var i = 0; i <= xlength / step; i++) {
        lineGeometry.vertices.push(new THREE.Vector3(i * step - xlength / 2, -
            ylength / 2, floor));
        lineGeometry.vertices.push(new THREE.Vector3(i * step - xlength / 2,
            ylength / 2, floor));
    }

    for (var i = 0; i <= ylength / step; i++) {
        lineGeometry.vertices.push(new THREE.Vector3(-xlength / 2, i * step -
            ylength / 2, floor));
        lineGeometry.vertices.push(new THREE.Vector3(xlength / 2, i * step -
            ylength / 2, floor));
    }

    var grid = new THREE.Line(lineGeometry, lineMaterial, THREE.LinePieces);
    scene.add(grid);

    return {
        renderer: renderer,
        camera: camera,
        scene: scene,
        lights: lights,
        // ground: ground,
        grid: grid
    };
}

//
//  copy content from one canvas to a new one
//
FORTE.cloneCanvas = function(oldCanvas) {
    //create a new canvas
    var newCanvas = document.createElement('canvas');
    var context = newCanvas.getContext('2d');

    //set dimensions
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;

    //apply the old canvas to the new one
    context.drawImage(oldCanvas, 0, 0);

    //return the new canvas
    return newCanvas;
}

//
//  center the camera (using TrackballControls object) to a design consisting of a bunch of edges
//      * optional: adding a manual offset
//
FORTE.centerCamera = function(camCtrl, edges, offset) {
    var bbox = FORTE.getBoundingBox(edges);

    var vmin = bbox.vmin;
    var vmax = bbox.vmax;
    var centroidish = bbox.centroidish;

    var r = vmax.distanceTo(vmin) * 0.5;
    var d = 4 * r * Math.sin(camCtrl.object.fov * 0.5 * Math.PI / 180);
    var ctrCamera = centroidish.clone();
    ctrCamera.z = d - camCtrl.object.position.z;

    if (offset != undefined) ctrCamera.add(offset);
    camCtrl.object.position.add(ctrCamera);
    camCtrl.target.add(ctrCamera);
    camCtrl.object.lookAt(camCtrl.target);

}

//
//  get the bounding box of a set of medial axis edges
//      * TODO: incorporate this into Medial Axis Class
//
FORTE.getBoundingBox = function(edges) {
    var cnt = 0;
    var xmin = Number.MAX_VALUE,
        ymin = Number.MAX_VALUE,
        zmin = Number.MAX_VALUE;
    var xmax = -Number.MAX_VALUE,
        ymax = -Number.MAX_VALUE,
        zmax = -Number.MAX_VALUE;
    for (var i = 0; i < edges.length; i++) {
        var points = edges[i].points;
        for (var j = 0; j < points.length; j++) {
            var p = points[j];

            xmax = Math.max(p[0], xmax);
            ymax = Math.max(p[1], ymax);
            zmax = Math.max(p[2], zmax);

            xmin = Math.min(p[0], xmin);
            ymin = Math.min(p[1], ymin);
            zmin = Math.min(p[2], zmin);
        }
    }

    var vmin = new THREE.Vector3(xmin, ymin, zmin);
    var vmax = new THREE.Vector3(xmax, ymax, zmax);
    var centroidish = vmin.clone().add(vmax).divideScalar(2);

    return {
        centroidish: centroidish,
        vmin: vmin,
        vmax: vmax
    };
}

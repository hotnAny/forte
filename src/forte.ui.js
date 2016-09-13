/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	a collection of routines to render ui elements
 *
 *	@author Xiang 'Anthony' Chen http://xiangchen.me
 *
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var FORTE = FORTE || {};

// FORTE.WIDTHCONTAINER = 320;

FORTE.renderUI = function() {
    var aspectRatio = 0.9; // h to w
    var widthWindow = window.innerWidth * 0.985;
    var heightWindow = window.innerHeight * 0.97;

    var tblLayout = $('<table></table>');
    tblLayout.css('max-height', heightWindow);
    var trLayout = $('<tr></tr>');
    tblLayout.append(trLayout);


    //
    //  set up main canvas
    //
    FORTE.tdCanvas = $('<td></td>');
    var widthCanvas = widthWindow * 0.7; // - widthOptView;
    var heightCanvas = heightWindow;
    canvasRenderSet = FORTE.createRenderableScene(widthCanvas, heightCanvas);
    FORTE.canvasRenderer = canvasRenderSet.renderer;
    FORTE.canvasScene = canvasRenderSet.scene;
    FORTE.canvasCamera = canvasRenderSet.camera;
    FORTE.camCtrl = new THREE.TrackballControls(FORTE.canvasCamera, undefined,
        undefined);
    FORTE.camCtrl.noZoom = true;

    FORTE.tdCanvas.on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        e.dataTransfer.dropEffect = 'copy';
    });

    FORTE.tdCanvas.on('drop', function(e) {
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
            } else if (files[i].name.endsWith('delta')) {
                log('loading optimized deltas')
                reader.onload = (function(e) {
                    if (FORTE.designObj == undefined) {
                        err('load the original design object first')
                    }
                    FORTE.deltaObj = JSON.parse(e.target.result);
                    var centroid = FORTE.getBoundingBox(FORTE.designObj.design).centroidish;
                    FORTE.transformOptimization(FORTE.deltaObj.design,
                        centroid, FORTE.designObj.dimVoxel, FORTE.designObj.width,
                        FORTE.designObj.height);

                    log(FORTE.deltaObj.design)

                    var design = FORTE.deltaObj.design.concat(FORTE.designObj.design);
                    FORTE.design._medialAxis.updateFromRawData(design, true);

                });
            }
            reader.readAsBinaryString(files[i]);
        }
    });

    FORTE.tdCanvas.append(FORTE.canvasRenderer.domElement);
    trLayout.append(FORTE.tdCanvas);


    var tdOptimization = $('<td></td>');

    //
    //  set up optimization view
    //
    var tblOptimization = $('<table></table>');
    tdOptimization.append(tblOptimization);
    var trOptView = $('<tr></tr>');
    var tdOptView = $('<td></td>')
    trOptView.append(tdOptView);
    tblOptimization.append(trOptView);

    var widthOptView = widthWindow - widthCanvas;
    var heightOptView = aspectRatio * widthOptView;
    optviewRenderSet = FORTE.createRenderableScene(widthOptView, heightOptView);
    FORTE.optRenderer = optviewRenderSet.renderer;
    FORTE.optScene = optviewRenderSet.scene;
    FORTE.optCamera = optviewRenderSet.camera;
    FORTE.optRenderer.render(FORTE.optScene, FORTE.optCamera);
    tdOptView.append(FORTE.optRenderer.domElement);

    tdOptView.on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        e.dataTransfer.dropEffect = 'copy';
    });

    tdOptView.on('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        var files = e.dataTransfer.files;

        for (var i = 0; i < files.length; i++) {
            var reader = new FileReader();
            log('loading user-guided deltas')
            reader.onload = (function(e) {
                if (FORTE.designObj == undefined) {
                    err('load the original design object first')
                }
                FORTE.genDeltas = FORTE.genDeltas || [];

                var deltaObj = JSON.parse(e.target.result);
                var centroid = FORTE.getBoundingBox(FORTE.designObj.design).centroidish;
                FORTE.transformOptimization(deltaObj.design,
                    centroid, FORTE.designObj.dimVoxel, FORTE.designObj.width,
                    FORTE.designObj.height);

                FORTE.genDeltas.push(deltaObj.design);

            });
            reader.readAsBinaryString(files[i]);
        }

        // HACK
        FORTE.design._medialAxis.onEdgeSelected = function() {
            var idx = this._edges.indexOf(this._edgeSelected);
            if (idx >= FORTE.genDeltas.length) return;

            var deltas = FORTE.genDeltas[idx];
            var design = deltas.concat(FORTE.designObj.design);

            var scene = FORTE.optScene.clone();
            var camera = FORTE.optCamera.clone();
            var camCtrl = new THREE.TrackballControls(camera, undefined,
                undefined);
            FORTE.MedialAxis.fromRawData(design, FORTE.tbnRenderer.domElement,
                scene, camera);
            FORTE.centerCamera(camCtrl, FORTE.designObj.design);
            FORTE.optRenderer.render(scene, camera);

            var deltasImgSrc = FORTE.genDeltasImgSrcs[idx];
            // FORTE.divOptThumbnails.empty();
            FORTE.imgThumbnail.src = deltasImgSrc;
        }
    });

    // tdOptView.click(function(e) {
    //     // NOTE: refresh for now
    //     if (FORTE.deltas != undefined)
    //         for (var i = 0; i < FORTE.deltas.length; i++) {
    //             FORTE.deltas[i]._slider.hide();
    //         }
    //     FORTE.deltas = [];
    //
    //     var delta = new FORTE.Delta(FORTE.designSpace.design, FORTE.viewedOptimization, FORTE.canvasRenderer
    //         .domElement, FORTE.canvasScene, FORTE.canvasCamera);
    //     FORTE.deltas.push(delta);
    //     FORTE.updateDeltas(true);
    // });

    //
    // set up thumbnails
    //
    var trThumbnails = $('<tr></tr>');
    FORTE.tdThumbnails = $('<td></td>')
    FORTE.divOptThumbnails = $('<div></div>');
    FORTE.divOptThumbnails.css('height', (heightWindow - heightOptView) + 'px');
    FORTE.divOptThumbnails.css('overflow', 'scroll');
    FORTE.thumbnailMargin = 8;
    FORTE.widthThumbnail = widthOptView / 3 - FORTE.thumbnailMargin * 2;
    FORTE.heightThumbnail = aspectRatio * FORTE.widthThumbnail;
    FORTE.imgThumbnail = new Image(148, 178);
    FORTE.tdThumbnails.append(FORTE.imgThumbnail);
    trThumbnails.append(FORTE.tdThumbnails);
    tblOptimization.append(trThumbnails);

    FORTE.tdThumbnails.on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        e.dataTransfer.dropEffect = 'copy';
    });

    FORTE.tdThumbnails.on('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;

        var files = e.dataTransfer.files;
        var arrFiles = [];
        for (var i = 0; i < files.length; i++) {
            arrFiles.push(files[i]);
        }

        arrFiles.reverse();
        FORTE.genDeltasImgSrcs = FORTE.genDeltasImgSrcs || [];
        var reader = new FileReader();
        reader.onload = (function(e) {
            log(reader.result)
            FORTE.genDeltasImgSrcs.push(reader.result);
            if (arrFiles.length > 0) reader.readAsDataURL(arrFiles.pop());
        });
        // for (var i = 0; i < files.length; i++) {
        // log('loading user-guided deltas (bmps)')
        reader.readAsDataURL(arrFiles.pop());
        // }
    });

    var thumbnailRenderSet = FORTE.createRenderableScene(FORTE.widthThumbnail, FORTE.heightThumbnail);
    FORTE.tbnRenderer = thumbnailRenderSet.renderer;
    FORTE.tbnScene = thumbnailRenderSet.scene;
    FORTE.tbnCamera = thumbnailRenderSet.camera;

    FORTE.thnClick = function(e) {
        var optDesign = FORTE.htOptimizations[this.id];
        var design = optDesign.concat(FORTE.designSpace.design);
        var scene = FORTE.optScene.clone();
        var camera = FORTE.optCamera.clone();
        var camCtrl = new THREE.TrackballControls(camera, undefined, undefined);
        FORTE.MedialAxis.fromRawData(design, FORTE.optRenderer.domElement, scene, camera);
        FORTE.centerCamera(camCtrl, FORTE.designSpace.design);
        FORTE.optRenderer.render(scene, camera);
        FORTE.viewedOptimization = optDesign;

        // FORTE.design._medialAxis.updateFromRawData(FORTE.designSpace.design.clone()
        // .concat(optDesign), true);
        // FORTE.design._medialAxis.updateFromRawData(FORTE.designSpace.design.clone()
        // .concat(optDesign));
        // var delta = new FORTE.Delta(FORTE.designSpace.design, optDesign, FORTE.canvasRenderer.domElement, FORTE.canvasScene, FORTE.canvasCamera);
    };

    trLayout.append(tdOptimization);

    return tblLayout;
}

FORTE.createRenderableScene = function(w, h) {
    var renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(w, h);
    renderer.setClearColor(XAC.BACKGROUNDCOLOR);

    var camera = new THREE.PerspectiveCamera(60, w / h, 1, 10000);
    camera.position.copy(new THREE.Vector3(0, 0, 200));
    var scene = new THREE.Scene();

    var lights = [];
    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[0].position.set(0, 100, -100);
    lights[0].castShadow = true;
    lights[0].position.copy(camera.position);
    scene.add(lights[0]);

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
        grid: grid
    };
}

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

FORTE.dragnDrop = function() {
    FORTE.htOptimizations = [];

    // drag & drop forte files
    $(document).on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        e.dataTransfer.dropEffect = 'copy';
    });

    $(document).on('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer = e.originalEvent.dataTransfer;
        var files = e.dataTransfer.files;

        for (var i = files.length - 1; i >= 0; i--) {
            var reader = new FileReader();
            reader.onload = (function(e) {
                FORTE.designSpace = JSON.parse(e.target.result);
                // log(e.target.result)
                log(FORTE.designSpace)

                //  load original design
                FORTE.design._medialAxis.updateFromRawData(FORTE.designSpace.design);
                FORTE.centerCamera(FORTE.camCtrl, FORTE.designSpace.design);
                var centroid = FORTE.getBoundingBox(FORTE.designSpace.design).centroidish;

                //  load optimizations and show them as thumbnails
                for (var i = 0; i < FORTE.designSpace.optimizations.length; i++) {
                    FORTE.transformOptimization(FORTE.designSpace.optimizations[i],
                        centroid, FORTE.designSpace.dimVoxel, FORTE.designSpace.width,
                        FORTE.designSpace.height);
                    var design = FORTE.designSpace.optimizations[i].concat(FORTE.designSpace
                        .design);
                    var scene = FORTE.tbnScene.clone();
                    var camera = FORTE.tbnCamera.clone();
                    var camCtrl = new THREE.TrackballControls(camera, undefined,
                        undefined);
                    // log('optimization #' + i)
                    FORTE.MedialAxis.fromRawData(design, FORTE.tbnRenderer.domElement,
                        scene, camera);
                    FORTE.centerCamera(camCtrl, FORTE.designSpace.design);
                    FORTE.tbnRenderer.render(scene, camera);

                    //  format and add thumbnail
                    var id = 'opt' + i;
                    FORTE.htOptimizations[id] = FORTE.designSpace.optimizations[i];
                    var thumbnail = $('<div id=' + id + '></div>');
                    thumbnail.append($(FORTE.cloneCanvas(FORTE.tbnRenderer.domElement)));
                    thumbnail.css('width', FORTE.widthThumbnail + 'px');
                    thumbnail.css('height', FORTE.heightThumbnail + 'px');
                    thumbnail.css('margin-right', FORTE.thumbnailMargin + 'px');
                    thumbnail.css('margin-top', FORTE.thumbnailMargin + 'px');
                    thumbnail.css('float', 'left');
                    thumbnail.click(FORTE.thnClick);
                    FORTE.divOptThumbnails.append(thumbnail);

                }
            });
            reader.readAsBinaryString(files[i]);
        }
    });
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

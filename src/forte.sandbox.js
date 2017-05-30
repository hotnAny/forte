$(document).ready(function () {
    FORTE.m = 1;
    $(document).keydown(XAC.keydown);
    XAC.on(XAC.UPARROW, function (e) {
        FORTE.m *= 2;
        log(FORTE.m);
    });
    XAC.on(XAC.DOWNARROW, function (e) {
        FORTE.m /= 2;
        log(FORTE.m);
    });
});
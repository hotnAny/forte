FORTE.getBitmap = function(text) {
    var rowsep = '\n';
    var colsep = ',';

    var rows = text.split(rowsep);
    
    var nrows = rows.length;
    var ncols = nrows>0?rows[0].split(colsep).length:0;

    if(nrows <= 0 || ncols <= 0) return;

    bitmap = [];
    for(row of rows) {
        var arrRowStr = row.split(colsep);
        var arrRow = [];
        for(str of arrRowStr) arrRow.push(parseFloat(str));
        bitmap.push(arrRow);
    }

    return bitmap;
}
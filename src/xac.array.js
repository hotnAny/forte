//	........................................................................................................
//
//  extensions for javascript array class, v0.1
//
//	by xiangchen@acm.org, 05/2017
//
//	........................................................................................................

//
//	return a replica of this array
//
Array.prototype.clone = function () {
	var arr = [];
	for (var i = 0; i < this.length; i++) {
		arr.push(this[i]);
	}
	return arr;
}

//
//	perform element-wise arithmetic addition
//
Array.prototype.add = function (arr, sign) {
	if (arr == undefined) return;
	sign = sign || 1;
	var len = Math.min(this.length, arr.length);
	for (var i = 0; i < len; i++) {
		this[i] += sign * arr[i];
	}
	return this;
}

//
//	arithmetically add a scalar to all elements of this array
//
Array.prototype.addScalar = function (s) {
	for (var i = 0; i < this.length; i++) {
		this[i] += s;
	}
	return this;
}

//
//	perform element-wise arithmetic subtraction
//
Array.prototype.sub = function (arr) {
	return this.add(arr, -1);
}

//
//	multiply a scalar to all elements of this array
//
Array.prototype.times = function (s) {
	for (var i = 0; i < this.length; i++) {
		this[i] *= s;
	}
	return this;
}

//
//	replace this array's elements with the input array's elements
//
Array.prototype.copy = function (arr) {
	this.splice(0, this.length);
	for (var i = 0; i < arr.length; i++) {
		this.push(arr[i]);
	}
}

//
//	remove an element from this array, using an optional compare function
//
Array.prototype.remove = function (elm, compFunc) {
	var toRemove = [];
	for (var i = this.length - 1; i >= 0; i--) {
		var equal = undefined;
		if (compFunc != undefined) {
			equal = compFunc(elm, this[i]);
		} else {
			equal = elm == this[i];
		}

		if (equal) {
			toRemove.push(i);
		}
	}

	for (var i = toRemove.length - 1; i >= 0; i--) {
		this.splice(toRemove[i], 1);
	}
}

//
//	remove an element at a given index
//
Array.prototype.removeAt = function (idx) {
	if (idx >= 0) return this.splice(idx, 1)[0];
}

//
//	stitch the elements using the given separator into a string
//
Array.prototype.stitch = function (sep) {
	var str = '';
	for (var i = this.length - 1; i >= 0; i--) {
		str = this[i] + (i < this.length - 1 ? sep : '') + str;
	}
	return str;
}

//
//	return the dimension of this array
//
Array.prototype.dimension = function () {
	var dim = [];
	var arr = this;
	while (arr.length != undefined) {
		dim.push(arr.length);
		arr = arr[0];
	}
	return dim;
}

//
//	return true if this array has exactly the same elements in the same order as the input array
//
Array.prototype.equals = function (arr) {
	if (this.length != arr.length) {
		return false;
	}

	for (var i = this.length - 1; i >= 0; i--) {
		if (this[i] != arr[i]) {
			return false;
		}
	}
	return true;
}

//
//	return the maximum value of this array
//
Array.prototype.max = function () {
	var maxVal = Number.MIN_VALUE;
	for (var i = this.length - 1; i >= 0; i--) {
		maxVal = Math.max(maxVal, this[i]);
	}
	return maxVal;
}

//
// similar to numpy's take https://docs.scipy.org/doc/numpy/reference/generated/numpy.take.html
// arrIndex is of this form:
//	[[x1, ..., xn], [y1, ..., yn], ... ], where, e.g.,
// 	[[x1, ..., xn] means along the 1st dim of this array, only consider x1-th, ... xn-th hyper-rows
//
Array.prototype.take = function (arrIndex) {
	var taken = [];
	for (var i = 0; i < arrIndex[0].length; i++) {
		var idx = arrIndex[0][i];
		if (arrIndex[1] != undefined) {
			taken.push(this[idx].take(arrIndex.slice(1)))
		} else {
			taken.push(this[idx]);
		}
	}
	return taken;
}

//
//	return the avaerage value of this array
//
Array.prototype.mean = function () {
	var sum = 0;
	for (var i = this.length - 1; i >= 0; i--) {
		if (isNaN(this[i])) {
			console.error('[Array.mean]: containing not numbers: ' + this[i])
			return;
		}
		sum += this[i];
	}

	return sum / this.length;
}

//
//	return the standard deviation of this array
//
Array.prototype.std = function () {
	var avg = this.mean();

	var sqsum = 0;
	for (var i = this.length - 1; i >= 0; i--) {
		if (isNaN(this[i])) {
			console.error('[Array.std]: input arrays contain not numbers: ' + this[i])
			return;
		}
		sqsum += Math.pow(this[i] - avg, 2);
	}

	return Math.sqrt(sqsum / (this.length - 1));
}

//
//
//
Array.prototype.median = function (percentile) {
	var array = this.clone();
	array.sort(function (x, y) {
		if (x < y) return -1
		else if (x > y) return 1;
		else return 0;
	});

	var idx = (percentile == undefined ? 0.5 : percentile) * array.length;
	return array[idx | 0];
}

//
// return an array that contains elements from this array but not from arr
//
Array.prototype.diff = function (arr) {
	var diffArr = [];

	for (var i = 0; i < this.length; i++) {
		if (arr.indexOf(this[i]) < 0) {
			diffArr.push(this[i]);
		}
	}

	return diffArr;
}

//
//
//
Array.prototype.last = function (val) {
	if (val != undefined && this.length > 0) {
		this[this.length - 1] = val;
	}
	return this.length > 0 ? this[this.length - 1] : undefined;
}

Array.prototype.lastBut = function (n) {
	return this.length > n ? this[this.length - 1 - n] : undefined;
}

//
//
//
Array.prototype.insert = function (elm, idx) {
	var tail = this.splice(idx);
	this.push(elm);
	this.copy(this.concat(tail));
}

//
//
//
XAC.initMDArray = function (dims, val) {
	if (dims.length == 1) {
		return new Array(dims[0]).fill(val);
	}

	var array = [];
	for (var i = 0; i < dims[0]; i++) {
		array.push(XAC.initMDArray(dims.slice(1), val));
	}
	return array;
}

//
//	trim each number in the array to a given precision
//
Array.prototype.trim = function (numDigits) {
	for (i = 0; i < this.length; i++) {
		this[i] = Number(this[i].toFixed(numDigits));
	}
	return this;
}

//
//
//
Array.prototype.nsigma = function (n) {
	var mean = this.mean();
	var std = this.std();
	return mean + n * std;
}
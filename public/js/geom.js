// NUMERIC FUNCTIONS

var num = {
	vecSum: numeric['+'],
	vecSub: numeric['-'],
	vecProd: numeric['*'],
	vecDiv: numeric['/'],
	inv: numeric.inv,
	transpose: numeric.transpose,
	dot: numeric.dot,
	det: numeric.det,
	norm2: numeric.norm2,
	norm2Squared: numeric.norm2Squared,
	id: (function() {
		return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
	})(),
	translate: function(x, y) {
		translateHelper = function(x, y) {
			return [[1, 0, x], [0, 1, y], [0, 0, 1]];
		};
		if (typeof y === "undefined") {
			return translateHelper(x[0], x[1]);
		} else {
			return translateHelper(x, y);
		}
	},
	translateBy: function(m, x, y) {
		if (typeof y === "undefined") {
			return this.dot(this.translate(x), m);
		} else {
			return this.dot(this.translate(x,y), m);
		}
	},
	getTranslation: function(m) {
		return [m[0][2], m[1][2]];
	},
	scale: function(factor) {
		return [[factor, 0, 0], [0, factor, 0], [0, 0, 1]];
	},
	scaleBy: function(m, factor) {
		return numeric.dot(m, this.scale(factor));
	},
	getScale: function(m) {
		return Math.sqrt(this.det(m));
	},
	rotate: function(theta) {
		return [[Math.cos(theta), -Math.sin(theta), 0],
		[Math.sin(theta), Math.cos(theta), 0], [0, 0, 1]];
	},
	rotateBy: function(m, theta) {
		return numeric.dot(m, this.rotate(theta));
	},
	getRotation: function(m) {
		var newm = _.cloneDeep(m);
		newm[0][2] = 0;
		newm[1][2] = 0;
		return newm;
	},
	matrixRound: function(m, precision) {
		var p = precision || config.globalPrecisionCap;
		var ret = _.map(m, function(row) {
			return _.map(row, function(n) {
				return Math.roundToPrecision(n, p);
			});
		});
		return ret;
	},
	getAngle: function(x, y) {
		var getAngleHelper = function(x, y) {
			if (x === 0 && y === 0) {
				return Math.PI / 2;
			} else {
				return Math.atan2(y, x);
			}
		};
		if (typeof y === "undefined") {
			return getAngleHelper(x[0], x[1]);
		} else {
			return getAngleHelper(x, y);
		}
	},
	flipX: function(m) {
		return numeric.dot([[-1,0,0],[0,1,0],[0,0,1]], m);
	},
	flipY: function(m) {
		return numeric.dot([[1,0,0],[0,-1,0],[0,0,1]], m);
	},
	getTransform: function(d) {
		var m = d.transform;
		return "matrix(" + m[0][0] + "," + m[1][0] +"," + m[0][1] +
			"," + m[1][1] + "," + m[0][2] + "," + m[1][2] +")";
	},
	vectorFromEnds: function(ends) {
		return this.vecSub(ends[1], ends[0]);
	},
	coordsToMatrix: function(coords) {
		var m = this.transpose(coords);
		m.push(_.map(_.range(coords.length), function() {return 1; }));
		return m;
	},
	matrixToCoords: function(m) {
		m.pop();
		return this.transpose(m);
	},
	dotWith2D: function(m, transform) {
		return this.matrixToCoords(this.dot(transform, this.coordsToMatrix(m)));
	},
	normalVector: function(ends) {
		var vector = this.vectorFromEnds(ends);
		return [-vector[1], vector[0]];
	},
	normalize: function(v) {
		return this.vecDiv(v, this.norm2(v));
	},
	edgeLength: function(ends) {
		return this.norm2(this.vectorFromEnds(ends));
	},
	edgeInterpolate: function(ends, proportion) {
		return this.vecSum(this.vecProd(ends[0], proportion),
			this.vecProd(ends[1], 1 - proportion));
	},
	edgeCenter: function(ends) {
		return this.edgeInterpolate(ends, 0.5);
	},
	angleBetweenVectors: function(v1, v2) {
		var ratio = this.dot(v1, v2) / this.norm2(v1) / this.norm2(v2);
		var angle = Math.acos(parseFloat((ratio).toFixed(3)));
		return angle;
	},
	angleBetweenEnds: function(v1, v2) {
		return this.angleBetweenVectors(this.vectorFromEnds(v1), this.vectorFromEnds(v2));
	},
	polarToRect: function(r, theta) {
		return [r * Math.cos(theta), r * Math.sin(theta)];
	},
	distFromPtToLineSquared: function(pt, lineEndpts) {
		var l2 = num.norm2Squared(num.vectorFromEnds(lineEndpts));
		if (l2 === 0) {
			return num.norm2(num.vecSub(pt, lineEndpts[0]));
		}
		var v = lineEndpts[0];
		var w = lineEndpts[1];
		var t = ((pt[0] - v[0]) * (w[0] - v[0]) + (pt[1] - v[1]) * (w[1] - v[1])) / l2;
		if (t < 0) return num.norm2(num.vecSub(pt, v));
		if (t > 1) return num.norm2(num.vecSub(pt, w));
		return num.norm2(num.vecSub(pt, [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])]));
	}
};

// helper function to calculate join
// used to find radial angle to an edge
var computeEdge = function(edgeNode) {
	var edgeEnds = d3.select(edgeNode).datum().ends;
	var edgeCenter = num.edgeCenter(edgeEnds);
	var normalVector = num.normalVector(edgeEnds);
	return {
		edgeCenter: edgeCenter,
		radialDist: num.norm2(edgeCenter),
		angle: num.getAngle(normalVector)
	};
};

// find transformation matrix
// to attach one tile to another via an edge
var calculateJoin = function(edgeNode, selectedObj) {
	var thisEdge = computeEdge(edgeNode);
	var otherEdge = computeEdge(selectedObj.edgeNode);

	var theta = thisEdge.angle;
	var psi = otherEdge.angle;

	otherEdge.edgeCenter.push(1);
	otherEdge.edgeCenter = num.rotateBy(otherEdge.edgeCenter, - (theta - psi + Math.PI));
	otherEdge.edgeCenter.pop();

	var translateVector = num.vecSub(thisEdge.edgeCenter, otherEdge.edgeCenter);
	// var y = thisEdge.edgeCenter[1] - otherEdge.edgeCenter[1];

	return num.translateBy(num.rotate(theta - psi + Math.PI), translateVector);
};

// convert all edges in a group to absolute coordinates
// used to check if edges coincide
var transformEdges = function(edges) {
	return _.map(_.flatten(edges, true), function(n) {
		var transformedCoords = transformEdge(n);
		return {
			node: n,
			ends: transformedCoords
		};
	});
};

var transformEdge = function(edgeNode) {
	var transform = num.dot(edgeNode.parentNode.parentNode.__data__.transform,
		edgeNode.parentNode.__data__.transform);

	return num.dotWith2D(edgeNode.__data__.ends, transform);
};

var approxEq = function(a, b, tolerance) {
	if (!tolerance) {
		tolerance = config.pixelTolerance; // appropriate for pixels
	}
	return Math.abs(a - b) < tolerance;
};

var approxEqPoints = function(x, y, tolerance) {
	return approxEq(x[0], y[0], tolerance) && approxEq(x[1],y[1], tolerance);
};


// fuzzy equals for a tuple of tuples
// used to decide when edges should automatically be joined
var approxEqEdges = function(x, y, tolerance) {
	return approxEqPoints(x[0], y[1], tolerance) && approxEqPoints(x[1],y[0], tolerance);
};

// pass in a tile node
// transform group coordinates to center the origin at that tile
var centerTileCoords = function(tileNode) {
	var tileTransform = d3.select(tileNode).datum().transform;
	var tileInverse = num.inv(tileTransform);

	d3.select(tileNode.parentNode)
	.each(function(d) {
		d.transform = num.matrixRound(num.dot(d.transform, tileTransform));
	})
	.attr("transform", num.getTransform)
	.selectAll("g.tile").each(function(d) {
		d.transform = num.matrixRound(num.dot(tileInverse, d.transform));
	})
	.attr("transform", num.getTransform);
};


// pass in a group node
// transform group coordinates to center origin at center of the group
var centerGroupCoords = function(groupNode) {

	var canvasBbox = computeVertexBbox(d3.select(groupNode).selectAll(".vertex"), true);

	var translation = num.translate(- canvasBbox.x - canvasBbox.width / 2,
		- canvasBbox.y - canvasBbox.height / 2);
	var invTranslation = num.inv(translation);

	d3.select(groupNode)
	.each(function(d) {
		d.transform = num.matrixRound(num.dot(d.transform, invTranslation));
	})
	.attr("transform", num.getTransform)
	.selectAll("g.tile").each(function(d) {
		d.transform = num.matrixRound(num.dot(translation, d.transform));
	})
	.attr("transform", num.getTransform);

	groupNode.undoCentering = function() {
		d3.select(this)
		.each(function(d) {
			d.transform = num.matrixRound(num.dot(d.transform, translation));
		})
		.attr("transform", num.getTransform)
		.selectAll("g.tile").each(function(d) {
			d.transform = num.matrixRound(num.dot(invTranslation, d.transform));
		})
		.attr("transform", num.getTransform);
	};
};

var computeVertexBbox = function(vertices, forGroupLevel) {
	var canvasBbox = {x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity};

	vertices.each(function(d) {
		var localCoords = [[d.x, d.y]];
		var transformedCoords = forGroupLevel ?
			// transform to group coordinates
			num.matrixToCoords(num.dot(this.parentNode.__data__.transform,
				num.coordsToMatrix(localCoords))) :
			// transform to canvas coordinates
			num.matrixToCoords(num.dot(this.parentNode.parentNode.__data__.transform,
				num.dot(this.parentNode.__data__.transform, num.coordsToMatrix(localCoords))));
		canvasBbox.x = Math.min(canvasBbox.x, transformedCoords[0][0]);
		canvasBbox.y = Math.min(canvasBbox.y, transformedCoords[0][1]);
		canvasBbox.x2 = Math.max(canvasBbox.x2, transformedCoords[0][0]);
		canvasBbox.y2 = Math.max(canvasBbox.y2, transformedCoords[0][1]);
	});

	if (_.all(_.values(canvasBbox), isFinite)) {
		canvasBbox.width = canvasBbox.x2 - canvasBbox.x;
		canvasBbox.height = canvasBbox.y2 - canvasBbox.y;
	}

	return canvasBbox;
};

var computeStripBbox = function(strips) {
	var canvasBbox = {x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity};

	strips.each(function(d) {
		var strip = this;
		_.each(_.flatten(d.points), function(p) {
			var transformedCoords = num.matrixToCoords(
				num.dot(strip.parentNode.__data__.transform, num.coordsToMatrix([[p.x, p.y]])));
			canvasBbox.x = Math.min(canvasBbox.x, transformedCoords[0][0]);
			canvasBbox.y = Math.min(canvasBbox.y, transformedCoords[0][1]);
			canvasBbox.x2 = Math.max(canvasBbox.x2, transformedCoords[0][0]);
			canvasBbox.y2 = Math.max(canvasBbox.y2, transformedCoords[0][1]);
		});
	});

	if (_.all(_.values(canvasBbox), isFinite)) {
		canvasBbox.width = canvasBbox.x2 - canvasBbox.x;
		canvasBbox.height = canvasBbox.y2 - canvasBbox.y;
	}

	return canvasBbox;
};

// some math to ensure after transfer from palette to canvas
// tiles stay in same position under the mouse but is appropriately scaled
var translateWithoutScale = function(group) {
	var absCoords = num.dot(assemblePalette.datum().transform,num.dot(assemblePaletteContainer.datum().transform, group.transform));
	var canvasFactor = num.getScale(assembleCanvas.datum().transform);
	var paletteFactor = num.getScale(assemblePaletteContainer.datum().transform);
	var canvasTrans = num.getTranslation(assembleCanvas.datum().transform);
	var absTrans = num.getTranslation(absCoords);
	var equivTrans = num.translate(num.vecDiv(num.vecSub(absTrans, canvasTrans), canvasFactor));

	return num.dot(equivTrans, num.dot(num.getRotation(absCoords), num.scale(1 / paletteFactor)));
};

var generateInRegionPredicate = function(hull, transform) {

	var vs = num.matrixToCoords(num.dot(transform, num.coordsToMatrix(_.map(hull, function(v) {
		return [v.x, v.y];
	}))));

	return function(point) {
		var x = point[0], y = point[1];

		var inside = false;
		for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
			var xi = vs[i][0], yi = vs[i][1];
			var xj = vs[j][0], yj = vs[j][1];

			var intersect = ((yi > y) != (yj > y)) &&
				(x < (xj - xi) * (y - yi) / (yj - yi) + xi);
			if (intersect) inside = !inside;
		}

		return inside;
	};
};
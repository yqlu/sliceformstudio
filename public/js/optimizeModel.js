var optimizeConfig = {
	constantConstraintFactor: 100,
	repulsionPower1: -8,
	repulsionFactor: 50000,
	repulsionThreshold: 5,
	repulsionPower2: 2
};

var makeSegment = function(params) {
	var groupIdx = params.groupIdx;
	var tileIdx = params.tileIdx;
	var patternIdx = params.patternIdx;
	params.polygonID = polylist[groupIdx].tiles[tileIdx].polygonID;
	params.customIdx = polylist[groupIdx].tiles[tileIdx].patterns[patternIdx].customIndex;
	var v1 = params.vertexRange[0];
	var v2 = params.vertexRange[1];
	var fix = params.fix;
	var segmentNode = params.this;

	var getElement = function() {
		var group = polylist[groupIdx];
		var tile = group.tiles[tileIdx];
		var modelTile = _.find(assembleSVGDrawer.get(), function(t) {
			return t.polygonID === tile.polygonID;
		});
		var pattern = modelTile.patterns[patternIdx];
		var isStraightSegment = (_.all(_.slice(pattern.intersectedVertices, v1 + 1, v2), function(v) {
			return v.intersect;
		}));
		var isBounded = (v1 >= 0) && (v2 < pattern.intersectedVertices.length);
		if (!isBounded) {
			throw new Error("Vertex indices are invalid.");
		} else if (!isStraightSegment) {
			throw new Error("Segments must be straight lines.");
		} else {
			return {group: group, tile: tile, pattern: pattern};
		}
	};

	// get pattern segment pointed to and retrieve global coords
	var getCoords = function() {
		var element = getElement();
		var patternCoords = [element.pattern.intersectedVertices[v1].coords,
			element.pattern.intersectedVertices[v2].coords];
		return num.matrixToCoords(num.dot(element.group.transform, num.dot(element.tile.transform,
			num.coordsToMatrix(patternCoords))));
	};

	var getRawNeighboringHandlePoints = function() {
		var element = getElement();
		var previousHandleIndexInIntersectedVertices = _.findLastIndex(
			element.pattern.intersectedVertices, function(v,i) {
			return i <= v1 && (!v.intersect || i === 0);
		});
		var nextHandleIndexInIntersectedVertices = _.findIndex(
			element.pattern.intersectedVertices, function(v, i) {
			return i >= v2 && (!v.intersect || i === element.pattern.intersectedVertices.length - 1);
		});

		return [previousHandleIndexInIntersectedVertices, nextHandleIndexInIntersectedVertices];
	};

	// compute pattern handles once
	// clicking on them in the GUI mutates the "fix" parameter
	// which gets passed to "getInterface"
	var patternHandles = (function() {

		var element = getElement();
		var patternType = patternOptions[element.tile.patternParams.index].name;
		var handles;
		if (patternType === "Custom") {

			var ct = element.tile.customTemplate[element.pattern.customIndex];
			var neighboringHandlePoints = getRawNeighboringHandlePoints();

			var numOfHandlesUpTo = _.filter(element.pattern.intersectedVertices, function(v , i) {
				return i < neighboringHandlePoints[0] && (!v.intersect || i === 0);
			}).length;

			handles = [{
				polygonID: params.polygonID,
				isCustom: true,
				intersectingIdx: neighboringHandlePoints[0],
				fix: true,
				customIdx: params.customIdx,
				customTemplateIdx: numOfHandlesUpTo - 1
			}, {
				polygonID: params.polygonID,
				isCustom: true,
				intersectingIdx: neighboringHandlePoints[1],
				fix: true,
				customIdx: params.customIdx,
				customTemplateIdx: numOfHandlesUpTo
			}];

			var numHandles = ct.points.length;
			if (ct.symmetrySpec === "mirrorNoCrop") {
				if (numOfHandlesUpTo === numHandles) {
					handles[1].customTemplateIdx = numOfHandlesUpTo - 1;
				} else if (numOfHandlesUpTo > numHandles) {
					handles[0].customTemplateIdx = numHandles * 2 - numOfHandlesUpTo;
					handles[1].customTemplateIdx = numHandles * 2 - 1 - numOfHandlesUpTo;
				}
			} else if (ct.symmetrySpec === "mirrorCrop") {
				if (numOfHandlesUpTo > numHandles - 1) {
					handles[0].customTemplateIdx = numHandles * 2 - 1 - numOfHandlesUpTo;
					handles[1].customTemplateIdx = numHandles * 2 - 2 - numOfHandlesUpTo;
				}
			}

			handles = _.filter(handles, function(h) {
				return h.customTemplateIdx >= 0 && h.customTemplateIdx < numHandles;
			});

		} else if (["Star", "Rosette", "Extended Rosette", "Hankin"].indexOf(patternType) > -1) {
			var firstHandleIdx = _.findIndex(
				element.pattern.intersectedVertices, function(v,i) {
				return (!v.intersect && i > 0);
			});
			var lastHandleIndex = _.findLastIndex(
				element.pattern.intersectedVertices, function(v, i) {
				return (!v.intersect && i < element.pattern.intersectedVertices.length - 1);
			});
			var intersectingIdx = ((v1 + v2) / 2 - (firstHandleIdx + lastHandleIndex) / 2 < 0) ?
				firstHandleIdx : lastHandleIndex;

			handles = [{
				polygonID: params.polygonID,
				isCustom: false,
				intersectingIdx: intersectingIdx,
				fix: true
			}];
		} else {
			throw new Error("Optimization is unsupported for this pattern type.");
		}

		var tileTransform = num.dot(element.group.transform, element.tile.transform);
		_.each(handles, function(h) {
			h.coords = num.matrixToCoords(num.dot(tileTransform,
				num.coordsToMatrix([element.pattern.intersectedVertices[h.intersectingIdx].coords])))[0];
		});

		return handles;
	})();

	var getInterface = function() {
		return _.filter(patternHandles, function(ph) {
			return !ph.fix;
		});
	};

	var setFixity = function(fixity) {
		fix = fixity;
	};

	return {
		originalParams: params,
		patternHandles: patternHandles,
		getElement: getElement,
		getCoords: getCoords,
		getInterface: getInterface,
		getNode: segmentNode,
		setFixity: setFixity
	};
};


var patternHandleComparator = function(d1, d2) {
	return (d1.polygonID === d2.polygonID &&
		((!d1.isCustom && !d2.isCustom) ||
		(d1.customIdx === d2.customIdx && d1.customTemplateIdx === d2.customTemplateIdx)));
};

var constraintUtils = {
	getAcuteAngleFromVectors: function(vectors) {
		var v1 = vectors[0];
		var v2 = vectors[1];
		var cosOfAngle = num.dot(v1,v2) / (num.norm2(v1) * num.norm2(v2));
		return Math.acos(Math.abs(cosOfAngle)) * 180 / Math.PI;
	},
	getAcuteAngleBetween: function(segments) {
		return this.getAcuteAngleFromVectors(_.map(segments, function(s) {
			return num.vectorFromEnds(s.getCoords());
		}));
	},
	getAngleOf: function(seg) {
		return this.getAcuteAngleFromVectors([num.vectorFromEnds(seg.getCoords()), [1, 0]]);
	},
	getLengthOf: function(seg) {
		return num.norm2(num.vectorFromEnds(seg.getCoords()));
	}
};

var enforceConstructor = function(options) {
	return {
		numSegments: options.numSegments,
		instructionText: options.instructionText,
		constantConstraint: options.constantConstraint,
		constructor: function(segments) {
			if (segments.length !== options.numSegments) {
				throw new Error("Number of segments must be exactly " + options.numSegments);
			}
			var evaluateFn = options.constructor(segments);
			return {
				evaluate: evaluateFn,
				segments: segments,
				displayName: options.displayName,
				evaluateUnit: options.evaluateUnit,
				factor: options.factor || 1,
				evaluateCache: [],
				cached: false,
				withInput: options.withInput
			};
		}
	};
};

var enforceParallel = enforceConstructor({
	constructor: function(segments) {
		return function() {
			return constraintUtils.getAcuteAngleBetween(segments);
		};
	},
	displayName: "Parallel",
	numSegments: 2,
	instructionText: "Select two segments to make parallel.",
	constantConstraint: false,
	evaluateUnit: "°"
});

var enforcePerpendicular = enforceConstructor({
	constructor: function(segments) {
		return function() {
			return Math.abs(constraintUtils.getAcuteAngleBetween(segments) - 90);
		};
	},
	displayName: "Perpendicular",
	numSegments: 2,
	instructionText: "Select two segments to make perpendicular.",
	constantConstraint: false,
	evaluateUnit: "°"
});

var enforceCollinear = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var seg1 = segments[0];
			var seg2 = segments[1];
			var seg1Coords = seg1.getCoords();
			var seg2Coords = seg2.getCoords();

			var v1 = num.vectorFromEnds(seg1Coords);
			var v2 = num.vectorFromEnds(seg2Coords);
			var v3 = num.vectorFromEnds([seg1Coords[0], seg2Coords[0]]);
			var v4 = num.vectorFromEnds([seg1Coords[0], seg2Coords[1]]);
			var v5 = num.vectorFromEnds([seg1Coords[1], seg2Coords[0]]);
			var v6 = num.vectorFromEnds([seg1Coords[1], seg2Coords[1]]);

			var n1 = num.norm2(v1);
			var n2 = num.norm2(v2);
			var n3 = num.norm2(v3);
			var n4 = num.norm2(v4);
			var n5 = num.norm2(v5);
			var n6 = num.norm2(v6);

			var pairs;
			if (seg1.getInterface().length === 0) {
				pairs = [[v1,v3,n1,n3], [v1,v4,n1,n4], [v1,v5,n1,n5], [v1,v6,n1,n6]];
			} else if (seg2.getInterface().length === 0) {
				pairs = [[v2,v3,n2,n3], [v2,v4,n2,n4], [v2,v5,n2,n5], [v2,v6,n2,n6]];
			} else {
				pairs = [[v1,v3,n1,n3], [v1,v4,n1,n4], [v1,v5,n1,n5], [v1,v6,n1,n6],
					[v2,v3,n2,n3], [v2,v4,n2,n4], [v2,v5,n2,n5], [v2,v6,n2,n6]];
			}

			var angles = _.map(pairs, function(params) {
				var cosOfAngle = num.dot(params[0], params[1]) / (params[2] * params[3]);
				return Math.acos(Math.abs(cosOfAngle)) * 180 / Math.PI;
			});

			return _.sum(angles) / pairs.length;
		};
	},
	displayName: "Collinear",
	numSegments: 2,
	instructionText: "Select two segments to make collinear.",
	constantConstraint: false,
	evaluateUnit: "°"
});

var enforceEqualLength = enforceConstructor({
	constructor: function(segments) {
		return function() {
			return Math.abs(constraintUtils.getLengthOf(segments[0]) -
				constraintUtils.getLengthOf(segments[1]));
		};
	},
	displayName: "Equal length",
	numSegments: 2,
	instructionText: "Select two segments to make equal length.",
	constantConstraint: false,
	evaluateUnit: "px"
});

var enforceBisection = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var aCoords = segments[0].getCoords();
			var bCoords = segments[1].getCoords();
			var a1 = {x: aCoords[0][0], y: aCoords[0][1]};
			var a2 = {x: aCoords[1][0], y: aCoords[1][1]};
			var b1 = {x: bCoords[0][0], y: bCoords[0][1]};
			var b2 = {x: bCoords[1][0], y: bCoords[1][1]};
			var intersect = Intersection.intersectLineLine(a1, a2, b1, b2);
			if (intersect.status === "No Intersection") {
				return Math.pow(10, 10);
			}
			return Math.abs(intersect.points[0].relative - 0.5) * constraintUtils.getLengthOf(segments[0]) +
				Math.abs(intersect.points[0].relative2 - 0.5) * constraintUtils.getLengthOf(segments[1]);
		};
	},
	displayName: "Bisect",
	numSegments: 2,
	instructionText: "Select two segments to bisect.",
	constantConstraint: false,
	evaluateUnit: "px"
});

var enforceConstantGradient = enforceConstructor({
	constructor: function(segments) {
		var seg = segments[0];
		var originalAngle = constraintUtils.getAngleOf(seg);
		return function() {
			return Math.abs(originalAngle - constraintUtils.getAngleOf(seg)) * 10;
		};
	},
	displayName: "Const Gradient",
	numSegments: 1,
	instructionText: "Select a segment whose gradient to hold constant.",
	constantConstraint: true,
	evaluateUnit: "°",
	factor: 10
});

var enforceConstantLength = enforceConstructor({
	constructor: function(segments) {
		var seg = segments[0];
		var originalLength = constraintUtils.getLengthOf(seg);
		return function() {
			return Math.abs(originalLength - constraintUtils.getLengthOf(seg));
		};
	},
	displayName: "Const Length",
	numSegments: 1,
	instructionText: "Select a segment whose length to hold constant.",
	constantConstraint: true,
	evaluateUnit: "px"
});

var enforceConstantAngle = enforceConstructor({
	constructor: function(segments) {
		var originalAngle = constraintUtils.getAcuteAngleBetween(segments);
		return function() {
			return Math.abs(originalAngle - constraintUtils.getAcuteAngleBetween(segments));
		};
	},
	displayName: "Const Angle",
	numSegments: 2,
	instructionText: "Select two segments to hold meeting angle constant.",
	constantConstraint: true,
	evaluateUnit: "°",
	factor: 10
});

var enforceSpecificAngle = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var angle = constraintUtils.getAcuteAngleBetween(segments);
			var inputValue = this.withInput.paramValue;
			return Math.abs(angle - inputValue);
		};
	},
	displayName: "Angle of ",
	numSegments: 2,
	instructionText: "Select two segments to meet at a particular angle.",
	withInput: {
		markup: "<input autocomplete='off' type='text' class='constraintParam'></input> °",
		paramValue: 0
	},
	evaluateUnit: "°"
});

var enforceSpecificGradient = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var angle = constraintUtils.getAngleOf(segments[0]);
			var inputValue = this.withInput.paramValue;
			return Math.abs(angle - inputValue);
		};
	},
	displayName: "Gradient of ",
	numSegments: 1,
	instructionText: "Select a segment which is to be a specific gradient.",
	withInput: {
		markup: "<input autocomplete='off' type='text' class='constraintParam'></input> °",
		paramValue: 0
	},
	evaluateUnit: "°"
});

var enforceSpecificLength = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var length = constraintUtils.getLengthOf(segments[0]);
			var inputValue = this.withInput.paramValue;
			return Math.abs(length - inputValue);
		};
	},
	displayName: "Length of ",
	numSegments: 1,
	instructionText: "Select a segment which is to be a specific length.",
	withInput: {
		markup: "<input autocomplete='off' type='text' class='constraintParam'></input>px",
		paramValue: 50,
	},
	evaluateUnit: "px"
});

var enforceLengthRatio = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var lengths = _.map(segments, constraintUtils.getLengthOf);
			var inputValue = this.withInput.paramValue;
			return Math.abs(lengths[0] / lengths[1] - inputValue);
		};
	},
	displayName: "Length ratio of ",
	numSegments: 2,
	instructionText: "Select two segments whose length ratio are to be constrained.",
	withInput: {
		markup: "<input autocomplete='off' type='text' class='constraintParam'></input>",
		paramValue: 1,
	},
	evaluateUnit: ""
});

var enforceLengthDifference = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var lengths = _.map(segments, constraintUtils.getLengthOf);
			var inputValue = this.withInput.paramValue;
			return Math.abs(Math.abs(lengths[0] - lengths[1]) - inputValue);
		};
	},
	displayName: "Length diff of ",
	numSegments: 2,
	instructionText: "Select two segments whose length difference are to be constrained.",
	withInput: {
		markup: "<input autocomplete='off' type='text' class='constraintParam'></input>px",
		paramValue: 0,
	},
	evaluateUnit: "px"
});

var createObjectives = function(objectives) {
	var evaluate = function() {
		var evaluatedValues = _.map(objectives, function(f) { return f.evaluate(); });
		return _.reduce(evaluatedValues,function(a,b) { return a + b; });
	};
	var getInterface = function() {
		var segments = _.flatten(_.map(objectives, function(o) { return o.segments; }));
		var interfaces = _.flatten(_.map(segments, function(s) { return s.getInterface(); }));
		// basic _.uniq function with custom comparator
		var reduced = _.reduce(interfaces, function(acc, i) {
			var findFn = function(i2) {
				return patternHandleComparator(i, i2);
			};
			if (_.find(acc, findFn)) {
				return acc;
			} else {
				return acc.concat(i);
			}
		}, []);
		return reduced;
	};
	var optimize = function() {
		var customInterface = this.getInterface();
		var initialVector = _.flatten(_.map(customInterface, function(i) {
			var tile = _.find(assembleSVGDrawer.get(), function(t) {
				return t.polygonID === i.polygonID;
			});
			if (i.isCustom) {
				return num.getTranslation(
					tile.customTemplate[i.customIdx].points[i.customTemplateIdx].transform);
			} else {
				return tile.patternParams.param1;
			}
		}));

		var numIterations = 0;
		var fnc = function(vector) {
			var f = updateCustomTemplates(vector, customInterface, evaluate);
			return f;
		};

		var dfnc = function(precision) {
			return function(vector) {
				var n = vector.length;
				var dfvec = _.map(_.range(n), function(i) {
					var diff = [];
					_.each(_.range(n), function(j) {
						if (i === j) {
							diff.push(precision);
						} else {
							diff.push(0);
						}
					});
					var v1 = num.vecSum(vector, diff);
					var v2 = num.vecSub(vector, diff);
					var fv1 = fnc(v1);
					var fv2 = fnc(v2);
					var df = (fnc(v1) - fnc(v2)) / (2 * precision);
					return df;
				});
				return dfvec;
			};
		};

		var optimizer = this;
		return new Promise(function(resolve, reject) {
			console.time("powell");
			powell(initialVector, fnc, 0.01, function(result) {
				console.timeEnd("powell");
				redrawTiles();
				invalidateStripCache();
				_.each(objectives, function(o) {
					o.cached = false;
				});
				optimizer.draw();
				redrawConstraintList();
				resolve(result);
			});
		});
	};

	var draw = function() {
		d3.selectAll(".pattern-segment-fixed")
		.attr("d", function(d) {
			var group = polylist[d.groupIdx];
			var tile = group.tiles[d.tileIdx];
			var pattern = tile.patterns[d.patternIdx];
			var intersectedVertices = pattern.intersectedVertices;
			var patternCoords = _.pluck(intersectedVertices.slice(d.vertexRange[0], d.vertexRange[1] + 1), "coords");
			var globalCoords = num.matrixToCoords(num.dot(group.transform,
				num.dot(tile.transform, num.coordsToMatrix(patternCoords))));
			d.globalCoords = globalCoords;
			return d3.svg.line()(globalCoords);
		});
		updateFixedPatternSegmentHandlePositions(d3.selectAll(".pattern-segment-fixable-point"));
	};

	return {
		evaluate: evaluate,
		getInterface: getInterface,
		optimize: optimize,
		draw: draw
	};
};

var redrawTiles = function() {
	assembleSVGDrawer.draw();

	var tilesInCanvas = assembleCanvas.selectAll("g.tile");
	tilesInCanvas.each(function(d, i) {
		var modelTile = _.find(assembleSVGDrawer.get(), function(t) {
			return t.polygonID === d.polygonID;
		});
		d3.select(this).selectAll("path.pattern").remove();
		d.customTemplate = _.cloneDeep(modelTile.customTemplate);
		d.patternParams = _.cloneDeep(modelTile.patternParams);
		var patternFn = patternOptions[d.patternParams.index].generator(d, d.patternParams.param1, d.patternParams.param2);
		polygonAddPattern(d, makePatterns(patternFn));
		polygonAddPatternMetadata(d);
		drawPatterns(d3.select(this), {});
	});
};


var updateCustomTemplates = function(vector, customInterface, evaluator) {
	var vectorCopy = vector.slice();

	var tiles = _.indexBy(_.uniq(_.map(customInterface, function(ci) {
		return _.find(assembleSVGDrawer.get(), function(t) {
			return t.polygonID === ci.polygonID;
		});
	})), "polygonID");

	var intersectedVertexInterfaces = _.indexBy(_.map(tiles, function(t) {
		return {
			polygonID: t.polygonID,
			vertexInterface: _.map(t.patterns, function(p) {
				return _.pluck(p.intersectedVertices, "intersect");
			})
		};
	}), "polygonID");

	_.each(customInterface, function(ci) {
		if (ci.isCustom) {
			tiles[ci.polygonID].customTemplate[ci.customIdx]
			.points[ci.customTemplateIdx] = {
				transform: num.translate.apply(null, vectorCopy.splice(0, 2))
			};
		} else {
			tiles[ci.polygonID].patternParams.param1 = vectorCopy.splice(0, 1)[0];
		}
	});

	_.each(tiles, function(tile) {
		var patternFn = makePatterns(patternOptions[tile.patternParams.index]
			.generator(tile, tile.patternParams.param1, tile.patternParams.param2));
		polygonAddPattern(tile, patternFn);
		polygonAddPatternMetadata(tile);
	});

	if (_.all(tiles, function(tile) {
		if (patternOptions[tile.patternParams.index].name !== "Custom") {
			assembleSVGDrawer.replace(tile);
			return true;
		} else if (_.all(tile.patterns, function(p, idx) {
			var newIntersectData = _.pluck(p.intersectedVertices, "intersect");
			var intersectDataPreserved = _.isEqual(newIntersectData,
				intersectedVertexInterfaces[tile.polygonID].vertexInterface[idx]);
			return intersectDataPreserved;
		})) {
			assembleSVGDrawer.replace(tile);
			return true;
		} else {
			return false;
		}
	})) {
		var value = evaluator() + _.sum(_.map(tiles, getRepulsionForce));
		return value;
	} else {
		console.log("HERE");
		return Math.pow(10,10);
	}
};

var getRepulsionForce = function(tile) {
	var interiorVertices = _.flatten(_.map(tile.patterns, function(p) {
		return _.filter(p.intersectedVertices, function(iv) {
			return !iv.intersect;
		});
	}));
	var vertexRepulsion = 0;
	for (var i = 0; i < interiorVertices.length; i++) {
		for (var j = i + 1; j < interiorVertices.length; j++) {
			var displacement = num.norm2(num.vectorFromEnds(
				[interiorVertices[i].coords, interiorVertices[j].coords]));
			vertexRepulsion += optimizeConfig.repulsionFactor * Math.pow(displacement, optimizeConfig.repulsionPower1);
		}
	}

	var vertexOutOfPolygonForce = 0;
	if (tile.customTemplate) {
		var inTilePredicate = generateInRegionPredicate(tile.vertices, num.id);

		var interiorTemplateVertices = _.flatten(_.map(tile.customTemplate, function(ct) {
			return _.map(ct.points, function(p) {
				return {
					coords: num.getTranslation(p.transform),
					occurences: ct.applicableEdges.length
				};
			});
		}));

		// assumes that custom template is actually symmetrical
		vertexOutOfPolygonForce = _.sum(_.map(interiorTemplateVertices, function(v) {
			var distFromEdges = _.map(tile.edges, function(e) {
				return num.distFromPtToLineSquared(v.coords, e.ends);
			});
			var distFromEdge = Math.min.apply(Math, distFromEdges);
			var inPoly = inTilePredicate(v.coords);
			var f = 0;
			if (inPoly && distFromEdge < optimizeConfig.repulsionThreshold) {
				// linear from 0 to 1
				f = 1 - distFromEdge / optimizeConfig.repulsionThreshold;
			} else if (!inPoly) {
				// quadratic increase
				f = 1 + Math.pow(distFromEdge, optimizeConfig.repulsionPower2);
			}

			return f * v.occurences;
		}));
	}

	return vertexRepulsion + vertexOutOfPolygonForce;
};

var setupOptimizeOverlay = function() {
	assembleOptimizeOverlay.style("visibility", "visible");
	assembleOptimizeCanvas.style("visibility", "visible");
	optimizeTable.style("display", "block");

	var patternSegments = _.flattenDeep(_.map(polylist, function(group, groupIdx) {
		return _.map(group.tiles, function(tile, tileIdx) {
			return _.map(tile.patterns, function(p, patternIdx) {
				var segments = [];
				var transformedVertices = _.map(p.intersectedVertices, function(v) {
					var coords = num.matrixToCoords(num.dot(group.transform,
						num.dot(tile.transform, num.coordsToMatrix([v.coords]))))[0];
					return {intersect: v.intersect, coords: coords};
				});
				var curSegment = {groupIdx: groupIdx, tileIdx: tileIdx, patternIdx: patternIdx, startIdx: 0, vertices: []};
				for (var i = 0; i < transformedVertices.length; i++) {
					var curVertex = transformedVertices[i];
					curSegment.vertices.push(curVertex);
					if ((!curVertex.intersect && i !== 0) || i === transformedVertices.length - 1) {
						curSegment.endIdx = i;
						curSegment.curRange = [
							{idx: 0, isActive: false},
							{idx: curSegment.vertices.length - 1, isActive: false}];
						segments.push(curSegment);
						curSegment = {groupIdx: groupIdx, tileIdx: tileIdx, patternIdx: patternIdx, startIdx: i, vertices: [curVertex]};
					}
				}
				return segments;
			});
		});
	}));

	assembleOptimizeCanvas.selectAll(".pattern-segment, .pattern-segment-endpoint").remove();
	assembleOptimizeCanvas.selectAll(".pattern-segment").data(patternSegments)
	.enter()
	.append("path")
	.each(function(d) { d.this = this; })
	.classed("pattern-segment", true)
	.attr("d", function(d) {
		return d3.svg.line()(_.pluck(d.vertices.slice(d.curRange[0].idx, d.curRange[1].idx + 1), "coords"));
	});
};

var teardownOptimizeOverlay = function() {
	assembleOptimizeOverlay.style("visibility", "hidden");
	assembleOptimizeCanvas.style("visibility", "hidden");
	optimizeTable.style("display", "none");
};

var patternSelectHandler = function(list, limit) {
	return function(d) {
		if (list.indexOf(d) > -1) {
			// remove it from the list
			list.splice(list.indexOf(d), 1);
			d3.select(this).classed("selected", false);
		} else {
			if (list.length < limit) {
				list.push(d);
				d3.select(this).classed("selected", true);
			}
		}
		d3.selectAll(".pattern-segment")
		.filter(function(d) {
			return !d3.select(this).classed("selected");
		}).classed("selectable", list.length < limit);
		drawPatternSegmentEndpoints(list);
		var disableNext = !(list.length === limit || (list.length >= 3 && limit === Infinity));
		d3.select("#nextOptimizeBtn")
			.classed("disabled", disableNext);
		$("#nextOptimizeBtnGroup").tooltip("destroy")
			.tooltip({placement: "bottom", title: disableNext ?
				"Select the required number of segments first." : ""});
	};
};

var updatePatternSegmentEndpointPositions = function(sel) {
	return sel
	.attr("cx", function(d) {
		if (d.isStart) {
			return d.seg.vertices[d.seg.curRange[0].idx].coords[0];
		} else {
			return d.seg.vertices[d.seg.curRange[1].idx].coords[0];
		}
	})
	.attr("cy", function(d) {
		if (d.isStart) {
			return d.seg.vertices[d.seg.curRange[0].idx].coords[1];
		} else {
			return d.seg.vertices[d.seg.curRange[1].idx].coords[1];
		}
	});
};

var updateFixedPatternSegmentHandlePositions = function(sel) {
	return sel
	.each(function(d) {
		var element = d.seg.getElement();
		var tileTransform = num.dot(element.group.transform, element.tile.transform);
		d.coords = num.matrixToCoords(num.dot(tileTransform,
			num.coordsToMatrix([element.pattern.intersectedVertices[d.intersectingIdx].coords])))[0];
	})
	.attr("cx", function(d) { return d.coords[0]; })
	.attr("cy", function(d) { return d.coords[1]; });
};

var patternSegmentDrag = d3.behavior.drag()
.on("drag", function(d, i) {
	var distances = _.map(d.seg.vertices, function(v) {
		return num.norm2(num.vecSub(v.coords, [d3.event.x, d3.event.y]));
	});
	var minDistIdx = _.reduce(distances, function(iMin, x, i) {
		var curDist = x;
		if (d.isStart && i >= d.seg.curRange[1].idx) {
			curDist = Infinity;
		} else if (!d.isStart && i <= d.seg.curRange[0].idx) {
			curDist = Infinity;
		}
		return curDist < distances[iMin] ? i : iMin;
	}, d.point.idx);

	if (minDistIdx !== d.point.idx) {
		if (d.isStart) {
			d.seg.curRange[0].idx = minDistIdx;
		} else {
			d.seg.curRange[1].idx = minDistIdx;
		}
		d.point.idx = minDistIdx;
		updatePatternSegmentEndpointPositions(d3.select(this));

		d3.select(d.seg.this)
		.attr("d", function(d) {
			return d3.svg.line()(_.pluck(d.vertices.slice(d.curRange[0].idx, d.curRange[1].idx + 1), "coords"));
		});
	}
});

var drawPatternSegmentEndpoints = function(segmentList) {
	var endpointsList = _.flatten(_.map(segmentList, function(seg) {
		return [{seg: seg, isStart: true, point: seg.curRange[0]}, {seg: seg, isStart: false, point: seg.curRange[seg.curRange.length - 1]}];
	}));
	assembleOptimizeCanvas.selectAll(".pattern-segment-endpoint").remove();
	var endpoints = assembleOptimizeCanvas.selectAll(".pattern-segment-endpoint").data(endpointsList)
	.enter()
	.append("circle")
	.classed("pattern-segment-endpoint clickable", true)
	.attr("r", 4)
	.on("mouseover", function(d) {
		d3.select(this).attr("r", 5);
	})
	.on("mouseout", function(d) {
		d3.select(this).attr("r", 4);
	})
	.call(patternSegmentDrag);

	return updatePatternSegmentEndpointPositions(endpoints);
};

var drawPatternSegmentCustomPoints = function(segmentList) {
	var handlePoints = _.flatten(_.map(segmentList, function(seg) {
		_.each(seg.patternHandles, function(ph) {
			ph.seg = seg;
		});
		return seg.patternHandles;
	}));

	assembleOptimizeCanvas.selectAll(".pattern-segment-endpoint").remove();
	var endpoints = assembleOptimizeCanvas.selectAll(".pattern-segment-endpoint").data(handlePoints)
	.enter()
	.append("circle")
	.classed("pattern-segment-fixable-point clickable", true)
	.classed("selected", function(d1) {
		var isSelected = _.find(createObjectives(optimizationConstraints).getInterface(),
			function(d2) { return patternHandleComparator(d1, d2); });
		d1.fix = !isSelected;
		return isSelected;
	})
	.attr("r", 3)
	.attr("cx", function(d) { return d.coords[0]; })
	.attr("cy", function(d) { return d.coords[1]; })
	.on("mouseover", function(d) { d3.select(this).attr("r", 4); })
	.on("mouseout", function(d) { d3.select(this).attr("r", 3); })
	.on("click", function(d1) {
		d1.fix = !d1.fix;
		d3.selectAll(".pattern-segment-fixable-point")
		.filter(function(d2) {
			return patternHandleComparator(d1, d2);
		})
		.each(function(d2) {
			d2.fix = d1.fix;
		})
		.classed("selected", !d1.fix);
		var disableNext = _.all(d3.selectAll(".pattern-segment-fixable-point.clickable")[0], function(n) {
			return n.__data__.fix;
		});
		d3.select("#nextOptimizeBtn")
			.classed("disabled", disableNext);
		$("#nextOptimizeBtnGroup").tooltip("destroy")
			.tooltip({placement: "bottom", title: disableNext ?
				"Select at least one point to vary." : ""});
	});

	var disableNext = _.all(d3.selectAll(".pattern-segment-fixable-point.clickable")[0],
	function(n) {
		return n.__data__.fix;
	});
	d3.select("#nextOptimizeBtn")
	.classed("disabled", disableNext);
	$("#nextOptimizeBtnGroup").tooltip("destroy")
		.tooltip({placement: "bottom", title: disableNext ?
			"Select at least one point to vary." : ""});
};

var bindToNextBtn = function(f) {
	nextOptimizeBtn.on("click", f);
};

var finishSelection = function(constraintSpec, selectedSegmentObjects) {
	return function() {
		d3.selectAll(".pattern-segment.selected")
		.classed("pattern-segment selected", false)
		.classed("pattern-segment-fixed", true);
		d3.selectAll(".pattern-segment-fixable-point")
		.classed("clickable", false)
		.on("click", null)
		.filter(function(d) { return d.fix; })
		.remove();

		exitConstraintSelection();
		var constructor = constraintSpec.constructor;
		optimizationConstraints.push(constructor(selectedSegmentObjects));
		_.each(optimizationConstraints, function(o) {
			// reset cache to only one element
			o.evaluateCache.splice(0, o.evaluateCache.length - 1);
		});
		redrawConstraintList();
		bindToNextBtn(null);
	};
};

var constraintHandler = function(constraintSpec) {
	return function() {
		setupOptimizeOverlay();
		d3.select("#nextOptimizeBtn").text("Next").classed("disabled", true);
		d3.select(".svg-instruction-bar").classed("hidden", false);
		d3.selectAll(".constraint-btns .btn")
		.classed("btn-primary", false)
		.classed("disabled btn-default", true);
		d3.selectAll("path.pattern-segment").classed("selectable", true);
		assembleSvgOptimizeLabel.text(constraintSpec.instructionText);
		var selectedSegments = [];
		$("#nextOptimizeBtnGroup").tooltip('destroy').tooltip({
			placement: "bottom",
			title: "Select the required number of segments first."});
		assembleOptimizeCanvas.selectAll(".pattern-segment")
		.on("click", patternSelectHandler(selectedSegments, constraintSpec.numSegments));
		if (constraintSpec.constantConstraint) {
			d3.select("#nextOptimizeBtn").text("Finish");
		}
		bindToNextBtn(function() {
			d3.selectAll("path.pattern-segment").classed("selectable", false)
			.on("click", null);
			assembleOptimizeCanvas.selectAll(".pattern-segment-endpoint").remove();
			var selectedSegmentObjects = _.map(selectedSegments, function(seg) {
				seg.vertexRange = [seg.startIdx + seg.curRange[0].idx, seg.startIdx + seg.curRange[1].idx];
				return makeSegment(seg);
			});
			if (constraintSpec.constantConstraint) {
				finishSelection(constraintSpec, selectedSegmentObjects)();
			} else {
				assembleSvgOptimizeLabel.text("Select points to vary during optimization.");
				drawPatternSegmentCustomPoints(selectedSegmentObjects);
				d3.select("#nextOptimizeBtn").text("Finish");
				bindToNextBtn(finishSelection(constraintSpec, selectedSegmentObjects));
			}
		});
	};
};

var exitConstraintSelection = function() {
	assembleOptimizeCanvas.selectAll(".pattern-segment, .pattern-segment-endpoint, .pattern-segment-fixable-point.clickable").remove();
	d3.select(".svg-instruction-bar").classed("hidden", true);
	d3.selectAll(".constraint-btns .btn")
	.classed("btn-primary", true)
	.classed("disabled btn-default", false);
};


var optimizationConstraints = [];

var highlightNodes = function(nodes) {
	d3.selectAll(".pattern-segment-fixed, .pattern-segment-fixable-point")
	.classed("highlighted", function(d) {
		return (_.find(nodes, function(n) {
			return n === (d.this || d.seg.getNode);
		}));
	})
	.classed("translucent-segment", function(d) {
		return !d3.select(this).classed("highlighted");
	});
};

var resetHighlightNodes = function() {
	d3.selectAll(".pattern-segment-fixed, .pattern-segment-fixable-point")
	.classed("translucent-segment highlighted", false);
};

var deleteNodes = function(nodes) {
	d3.selectAll(".pattern-segment-fixed, .pattern-segment-fixable-point")
	.filter(function(d) {
		return (_.find(nodes, function(n) {
			return n === (d.this || d.seg.getNode);
		}));
	})
	.remove();
};

var deleteConstraint = function(constraint) {
	deleteNodes(_.pluck(constraint.segments, "getNode"));
	optimizationConstraints.splice(optimizationConstraints.indexOf(constraint), 1);
	redrawConstraintList();
};

var deleteAllConstraints = function() {
	deleteNodes(_.flatten(_.map(optimizationConstraints, function(c) {
		return _.pluck(c.segments, "getNode");
	})));
	optimizationConstraints.splice(0, optimizationConstraints.length);
	redrawConstraintList();
};

var updateObjectiveValues = function() {
	_.each(optimizationConstraints, function(d) {
		if (!d.cached) {
			d.evaluateCache.push(d.evaluate());
			if (d.evaluateCache.length > 2) {
				d.evaluateCache.splice(0, d.evaluateCache.length - 2);
			}
			d.cached = true;
		}
	});

	totalObjectiveLabel.text(function() {
		var value = "";
		var indices = (_.all(optimizationConstraints, function(d) {
			return d.evaluateCache.length === 2;
		})) ? [0,1] : [0];
		return "Sum of objectives: " + _.map(indices, function(i) {
			return parseFloat((_.sum(_.map(optimizationConstraints, function(o) {
				return o.evaluateCache[i] * o.factor;
			}))).toPrecision(3));
		}).join("→");
	});

	sidebarConstraintForm.selectAll(".constraint-row").selectAll(".objectiveLabel")
	.html(function() {
		var d = this.parentNode.__data__;
		return "Objective value: " + _.map(d.evaluateCache, function(n) {
			return parseFloat(n.toPrecision(3)) + d.evaluateUnit;
		}).join("→");
	});
};

var redrawConstraintList = function() {
	sidebarConstraintForm.selectAll(".constraint-row").remove();
	if (optimizationConstraints.length === 0) {
		optimizeBtnDiv.style("display", "none");
		noConstraintsSoFar.style("display", "block");
		totalObjectiveLabel.text("");
		return;
	}
	// implicit else
	optimizeBtnDiv.style("display", "block");
	noConstraintsSoFar.style("display", "none");
	var ctr = (function() {
		var num = 0;
		return function() {
			num += 1;
			return num;
		};
	})();

	var listRows = sidebarConstraintForm.selectAll(".constraint-row").data(optimizationConstraints)
	.enter()
	.append("div").classed("constraint-row", true)
	.html(function(d) {
		var deleteX = "<a class='strip-table-x' href='#'><i class='fa fa-times'></i></a>";
		var inputParams = d.withInput ? (" " + d.withInput.markup) : "";
		var displayName = "<h5 class='inline-title'>" + d.displayName + inputParams + "</h5>";
		var segmentList = "(<span class='segments'></span>)";
		var objective = "<div class='objectiveLabel small'></div>";
		var scaleFactor = "<div class='scaleLabel small'>Scaling factor: <input type='text' class='constraintScale'> x</div>";
		return deleteX + " " + displayName + " " + segmentList + objective + scaleFactor;
	}).each(function(d) {
		d3.select(this).select(".constraintScale")
		.attr("value", function() {
			var d = this.parentNode.parentNode.__data__;
			return d.factor;
		})
		.on("blur", function() {
			var d = this.parentNode.parentNode.__data__;
			d.factor = parseFloat($(this).val(), 10);
			updateObjectiveValues();
		});

		if (d.withInput) {
			d3.select(this).select(".constraintParam")
			.attr("value", function() {
				var d = this.parentNode.parentNode.__data__;
				return d.withInput.paramValue;
			})
			.on("blur", function() {
				var d = this.parentNode.parentNode.__data__;
				d.withInput.paramValue = parseFloat($(this).val(), 10);
				d.cached = false;
				d.evaluateCache.splice(d.evaluateCache.length - 1, 1);
				updateObjectiveValues();
			});
		}
	});

	updateObjectiveValues();

	listRows.select(".strip-table-x")
	.on("click", function(d, i) {
		var constraint = this.parentNode.__data__;
		deleteConstraint(constraint);
	});

	listRows.select("h5")
	.on("mouseover", function() {
		var d = this.parentNode.__data__;
		highlightNodes(_.pluck(d.segments, "getNode"));
	})
	.on("mouseout", resetHighlightNodes);

	listRows.select(".segments").selectAll(".segment-label")
	.data(function(d) { return this.parentNode.parentNode.__data__.segments; })
	.enter()
	.append("span")
	.classed("segment-label", true)
	.html(function(d, i) {
		var fullList = this.parentNode.parentNode.__data__.segments;
		return "<a href='#'>#" + ctr() + ((i === fullList.length - 1) ? "" : ", ") + "</a>";
	})
	.on("mouseover", function(d) {
		highlightNodes([d.getNode]);
	})
	.on("mouseout", resetHighlightNodes);

};
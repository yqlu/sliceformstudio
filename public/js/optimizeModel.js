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

		} else if (["Star", "Rosette", "Extended Rosette"].indexOf(patternType) > -1) {
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

var enforceConstructor = function(options) {
	return {
		numSegments: options.numSegments,
		instructionText: options.instructionText,
		constructor: function(segments) {
			if (segments.length !== options.numSegments) {
				throw new Error("Number of segments must be exactly " + options.numSegments);
			}
			var evaluateFn = options.constructor(segments);
			return {
				evaluate: evaluateFn,
				segments: segments,
				displayName: options.displayName,
			};
		}
	};
};

var enforceParallel = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var seg1 = segments[0];
			var seg2 = segments[1];
			var v1 = num.vectorFromEnds(seg1.getCoords());
			var v2 = num.vectorFromEnds(seg2.getCoords());
			var cosOfAngle = num.dot(v1,v2) / (num.norm2(v1) * num.norm2(v2));
			return Math.acos(Math.abs(cosOfAngle)) * 180 / Math.PI;
		};
	},
	displayName: "Parallel",
	numSegments: 2,
	instructionText: "Select two segments to make parallel."
});

var enforcePerpendicular = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var seg1 = segments[0];
			var seg2 = segments[1];
			var v1 = num.vectorFromEnds(seg1.getCoords());
			var v2 = num.vectorFromEnds(seg2.getCoords());
			var cosOfAngle = num.dot(v1,v2) / (num.norm2(v1) * num.norm2(v2));
			return Math.abs(Math.acos(Math.abs(cosOfAngle)) - Math.PI / 2) * 180 / Math.PI;
		};
	},
	displayName: "Perpendicular",
	numSegments: 2,
	instructionText: "Select two segments to make perpendicular."
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

			var angles = _.map([[v1,v3,n1,n3], [v1,v4,n1,n4], [v1,v5,n1,n5], [v1,v6,n1,n6],
				[v2,v3,n2,n3], [v2,v4,n2,n4], [v2,v5,n2,n5], [v2,v6,n2,n6]], function(params) {
				var cosOfAngle = num.dot(params[0], params[1]) / (params[2] * params[3]);
				return Math.acos(Math.abs(cosOfAngle)) * 180 / Math.PI;
			});

			return _.sum(angles);
		};
	},
	displayName: "Collinear",
	numSegments: 2,
	instructionText: "Select two segments to make collinear."
});

var enforceEqualLength = enforceConstructor({
	constructor: function(segments) {
		return function() {
			var seg1 = segments[0];
			var seg2 = segments[1];
			var len1 = num.norm2(num.vectorFromEnds(seg1.getCoords()));
			var len2 = num.norm2(num.vectorFromEnds(seg2.getCoords()));
			return Math.abs(len1 - len2);
		};
	},
	displayName: "Equal length",
	numSegments: 2,
	instructionText: "Select two segments to make equal length."
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
			return updateCustomTemplates(vector, customInterface, evaluate);
		};

		result = powell(initialVector, fnc, 0.01);

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

		invalidateStripCache();
		this.draw();

		return result;
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
			var eq = _.isEqual(newIntersectData,
				intersectedVertexInterfaces[tile.polygonID].vertexInterface[idx]);
			return eq;
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
		return _.filter(_.map(p.intersectedVertices, function(iv, idx) {
			iv.idx = idx;
			iv.p = p;
			return iv;
		}), function(iv) {
			return !iv.intersect;
		});
	}));
	var force = 0;
	var factor = 100000;
	var exponent = -8;
	for (var i = 0; i < interiorVertices.length; i++) {
		for (var j = i + 1; j < interiorVertices.length; j++) {
			var displacement = num.norm2(num.vectorFromEnds(
				[interiorVertices[i].coords, interiorVertices[j].coords]));
			force += factor * Math.pow(displacement, exponent);
		}
	}
	return force;
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

var constraintHandler = function(constraintSpec) {
	return function() {
		setupOptimizeOverlay();
		d3.select(".svg-instruction-bar").classed("hidden", false);
		d3.selectAll(".constraint-btns .btn").classed("disabled", true);
		d3.selectAll("path.pattern-segment").classed("selectable", true);
		assembleSvgOptimizeLabel.text(constraintSpec.instructionText);
		var selectedSegments = [];
		$("#nextOptimizeBtnGroup").tooltip({
			placement: "bottom",
			title: "Select the required number of segments first."});
		bindToNextBtn(function() {
			d3.selectAll("path.pattern-segment").classed("selectable", false)
			.on("click", null);
			assembleSvgOptimizeLabel.text("Select points to vary during optimization.");
			assembleOptimizeCanvas.selectAll(".pattern-segment-endpoint").remove();
			var selectedSegmentObjects = _.map(selectedSegments, function(seg) {
				seg.vertexRange = [seg.startIdx + seg.curRange[0].idx, seg.startIdx + seg.curRange[1].idx];
				return makeSegment(seg);
			});
			drawPatternSegmentCustomPoints(selectedSegmentObjects);
			bindToNextBtn(function() {
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
				redrawConstraintList();
				bindToNextBtn(null);
			});
		});
		assembleOptimizeCanvas.selectAll(".pattern-segment")
		.on("click", patternSelectHandler(selectedSegments, constraintSpec.numSegments));
	};
};

var exitConstraintSelection = function() {
	assembleOptimizeCanvas.selectAll(".pattern-segment, .pattern-segment-endpoint").remove();
	d3.select(".svg-instruction-bar").classed("hidden", true);
	d3.selectAll(".constraint-btns .btn").classed("disabled", false);
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

var redrawConstraintList = function() {
	sidebarConstraintForm.selectAll(".constraint-row").remove();
	if (optimizationConstraints.length === 0) {
		optimizeBtnDiv.style("display", "none");
		deleteAllConstraintsBtn.style("display", "none");
		noConstraintsSoFar.style("display", "block");
		return;
	}
	// implicit else
	optimizeBtnDiv.style("display", "block");
	deleteAllConstraintsBtn.style("display", "block");
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
	.html(function(d) { return "<a class='strip-table-x' href='#'><i class='fa fa-times'></i></a> <h5 class='inline-title'>" + d.displayName + "</h5> (<span class='segments'></span>)"; });

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
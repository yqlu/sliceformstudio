var drawIntersectedVertices = function() {
	assembleCanvas.selectAll(".tile")
	.each(function(d) {
		var tile = this;
		d3.select(this).selectAll("circle.intersected")
		.data(function(d) { return _.flatten(_.pluck(d.patterns, "intersectedVertices")); })
		.enter()
		.append("circle")
		.each(function(d) { d.this = this; })
		.attr("cx", function(d) { return d.coords[0]; })
		.attr("cy", function(d) { return d.coords[1]; })
		.classed("intersected", true)
		.attr("r", 2)
		.attr("color", "black");
	});
};

var makeSegment = function(params) {
	var groupIdx = params.groupIdx;
	var tileIdx = params.tileIdx;
	var patternIdx = params.patternIdx;
	var v1 = params.vertices[0];
	var v2 = params.vertices[1];
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

	// var draw = function(params) {
	// 	var element = getElement();
	// 	var pattern = element.tile.patterns[patternIdx];
	// 	if (element.tile.segments) {
	// 		element.tile.segments.push([pattern.intersectedVertices[v1], pattern.intersectedVertices[v2]]);
	// 	} else {
	// 		element.tile.segments = [[pattern.intersectedVertices[v1], pattern.intersectedVertices[v2]]];
	// 	}
	// 	var segmentGroup = d3.select(element.tile.this).selectAll(".segment")
	// 	.data(function(d) { return d.segments; })
	// 	.enter()
	// 	.append("g")
	// 	.classed("segment", true);

	// 	segmentGroup
	// 	.append("path")
	// 	.style("stroke", params.color || "blue")
	// 	.attr("d", function(d) {
	// 		return d3.svg.line()(_.pluck(d, "coords"));
	// 	});

	// 	if (params && params.highlightHandle) {
	// 		var previousHandleIndexInIntersectedVertices = _.findLast(
	// 			element.pattern.intersectedVertices, function(v,i) {
	// 			return i <= v1 && (!v.intersect || i === 0);
	// 		});
	// 		var nextHandleIndexInIntersectedVertices = _.find(
	// 			element.pattern.intersectedVertices, function(v, i) {
	// 			return i >= v2 && (!v.intersect || i === element.pattern.intersectedVertices.length - 1);
	// 		});
	// 		var handles = [previousHandleIndexInIntersectedVertices, nextHandleIndexInIntersectedVertices];
	// 		if (fix === "first") {
	// 			handles = [handles[1]];
	// 		} else if (fix === "second") {
	// 			handles = [handles[0]];
	// 		} else if (fix === "both") {
	// 			handles = [];
	// 		}

	// 		handles = _.filter(handles, function(h, idx) {
	// 			return h !== element.pattern.intersectedVertices[0] &&
	// 			h !== _.last(element.pattern.intersectedVertices);
	// 		});

	// 		segmentGroup
	// 		.selectAll(".segmentHandle").data(handles).enter()
	// 		.append("circle")
	// 		.attr("cx", function(d) { return d.coords[0]; })
	// 		.attr("cy", function(d) { return d.coords[1]; })
	// 		.attr("r", 3)
	// 		.attr("fill", "red");
	// 	}
	// };



	// get pattern segment pointed to and retrieve global coords
	var getCoords = function() {
		var element = getElement();
		var patternCoords = [element.pattern.intersectedVertices[v1].coords,
			element.pattern.intersectedVertices[v2].coords];
		return num.matrixToCoords(num.dot(element.group.transform, num.dot(element.tile.transform,
			num.coordsToMatrix(patternCoords))));
	};

	// if pattern is from a custom template,
	// retrieve pattern handles (indexed from 0 to customTemplate[i].points.length - 1)
	// responsible for the segment in question
	var getPatternHandles = function() {
		var element = getElement();
		var ct = element.tile.customTemplate[element.pattern.customIndex];
		var previousHandleIndexInIntersectedVertices = _.findLastIndex(
			element.pattern.intersectedVertices, function(v,i) {
			return i <= v1 && (!v.intersect || i === 0);
		});
		var nextHandleIndexInIntersectedVertices = _.findIndex(
			element.pattern.intersectedVertices, function(v, i) {
			return i >= v2 && (!v.intersect || i === element.pattern.intersectedVertices.length - 1);
		});
		var numOfHandlesUpTo = _.filter(element.pattern.intersectedVertices, function(v , i) {
			return i < previousHandleIndexInIntersectedVertices && (!v.intersect || i === 0);
		}).length;
		var previousHandleIndexInCustomTemplate = numOfHandlesUpTo - 1;
		var nextHandleIndexInCustomTemplate = numOfHandlesUpTo;

		var handles = [previousHandleIndexInCustomTemplate, nextHandleIndexInCustomTemplate];
		var numHandles = ct.points.length;
		if (ct.symmetrySpec === "mirrorNoCrop") {
			if (nextHandleIndexInCustomTemplate === numHandles) {
				handles = [previousHandleIndexInCustomTemplate, previousHandleIndexInCustomTemplate];
			} else if (nextHandleIndexInCustomTemplate > numHandles) {
				handles = [numHandles * 2 - 1 - nextHandleIndexInCustomTemplate,
					numHandles * 2 - 1 - previousHandleIndexInCustomTemplate];
			}
		} else if (ct.symmetrySpec === "mirrorCrop") {
			if (nextHandleIndexInCustomTemplate > numHandles - 1) {
				handles = [numHandles * 2 - 2 - nextHandleIndexInCustomTemplate,
					numHandles * 2 - 2 - previousHandleIndexInCustomTemplate];
			}
		}
		if (fix === "first") {
			handles = [handles[1]];
		} else if (fix === "second") {
			handles = [handles[0]];
		} else if (fix === "both") {
			handles = [];
		}
		return _.map(_.filter(handles, function(i) { return i >= 0 && i < numHandles; }),
			function(h) { return [element.pattern.customIndex, h]; });
	};

	var getInterface = function() {
		var element = getElement();
		var patternType = patternOptions[element.tile.patternParams.index].name;
		if (patternType === "Custom") {
			return _.map(getPatternHandles(), function(ph) {
				return {
					polygonID: element.tile.polygonID,
					isCustom: true,
					templateSpec: ph
				};
			});
		} else if (["Star", "Rosette", "Extended Rosette"].indexOf(patternType) > -1) {
			if (fix) {
				return [];
			} else {
				return [{
					polygonID: element.tile.polygonID,
					isCustom: false
				}];
			}
		} else {
			throw new Error("Optimization is unsupported for this pattern type.");
		}
	};

	return {
		// draw: draw,
		getElement: getElement,
		getCoords: getCoords,
		getInterface: getInterface,
		getNode: segmentNode
	};
};

var enforceConstructor = function(evaluateConstructor, displayName) {
	return function(seg1, seg2) {
		var evaluateFn = evaluateConstructor(seg1, seg2);
		return {
			evaluate: evaluateFn,
			segments: [seg1, seg2],
			displayName: displayName
		};
	};
};

var enforceParallel = enforceConstructor(function(seg1, seg2) {
	return function() {
		var v1 = num.vectorFromEnds(seg1.getCoords());
		var v2 = num.vectorFromEnds(seg2.getCoords());
		var cosOfAngle = num.dot(v1,v2) / (num.norm2(v1) * num.norm2(v2));
		return Math.acos(Math.abs(cosOfAngle)) * 180 / Math.PI;
	};
}, "Parallel");

var enforceCollinear = enforceConstructor(function(seg1, seg2) {
	return function() {
		var seg1Coords = seg1.getCoords();
		var seg2Coords = seg2.getCoords();

		var v1 = num.vectorFromEnds(seg1Coords);
		var v2 = num.vectorFromEnds(seg2Coords);
		var v3 = num.vectorFromEnds([seg1Coords[0], seg2Coords[0]]);
		var v4 = num.vectorFromEnds([seg1Coords[0], seg2Coords[1]]);

		var n1 = num.norm2(v1);
		var n2 = num.norm2(v2);
		var n3 = num.norm2(v3);
		var n4 = num.norm2(v4);

		var angles = _.map([[v1,v3,n1,n3], [v1,v4,n1,n4]], function(params) {
			var cosOfAngle = num.dot(params[0], params[1]) / (params[2] * params[3]);
			return Math.acos(Math.abs(cosOfAngle)) * 180 / Math.PI;
		});

		return _.sum(angles);
	};
}, "Collinear");

var enforceEqualLength = enforceConstructor(function(seg1, seg2) {
	return function() {
		var len1 = num.norm2(num.vectorFromEnds(seg1.getCoords()));
		var len2 = num.norm2(num.vectorFromEnds(seg2.getCoords()));
		return Math.abs(len1 - len2);
	};
}, "Equal length");

var createObjectives = function(objectives) {
	var evaluate = function() {
		var evaluatedValues = _.map(objectives, function(f) { return f.evaluate(); });
		return _.reduce(evaluatedValues,function(a,b) { return a + b; });
	};
	var getInterface = function() {
		var segments = _.flatten(_.map(objectives, function(o) { return o.segments; }));
		var interfaces = _.flatten(_.map(segments, function(s) { return s.getInterface(); }));
		// TODO: have a better uniqWith by updating to lodashv4
		return _.uniq(interfaces, JSON.stringify);
	};
	var optimize = function() {
		var customInterface = this.getInterface();
		var initialVector = _.flatten(_.map(customInterface, function(i) {
			var tile = _.find(assembleSVGDrawer.get(), function(t) {
				return t.polygonID === i.polygonID;
			});
			if (i.isCustom) {
				return num.getTranslation(
					tile.customTemplate[i.templateSpec[0]].points[i.templateSpec[1]].transform);
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
			var patternCoords = _.pluck(intersectedVertices.slice(d.vertices[0], d.vertices[1] + 1), "coords");
			var globalCoords = num.matrixToCoords(num.dot(group.transform,
				num.dot(tile.transform, num.coordsToMatrix(patternCoords))));
			d.globalCoords = globalCoords;
			return d3.svg.line()(globalCoords);
		});
		updateFixedPatternSegmentHandlePositions(d3.selectAll(".pattern-segment-handle-fixed"));
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
			tiles[ci.polygonID].customTemplate[ci.templateSpec[0]]
			.points[ci.templateSpec[1]] = {
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

	assembleOptimizeCanvas.selectAll(".pattern-segment, .pattern-segment-handle").remove();
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

var patternSelectHandler = function(list, limit, limitCallback) {
	return function(d) {
		if (list.indexOf(d) > -1) {
			// remove it from the list
			list.splice(list.indexOf(d), 1);
			d3.select(this).classed("selected", false);
		} else {
			list.push(d);
			d3.select(this).classed("selected", true);
		}
		drawPatternSegmentHandles(list);
	};
};

var updateFixedPatternSegmentHandlePositions = function(sel) {
	return sel
	.attr("cx", function(d) {
		if (d.isStart) {
			return d.seg.globalCoords[0][0];
		} else {
			return _.last(d.seg.globalCoords)[0];
		}
	})
	.attr("cy", function(d) {
		if (d.isStart) {
			return d.seg.globalCoords[0][1];
		} else {
			return _.last(d.seg.globalCoords)[1];
		}
	});
};

var updatePatternSegmentHandlePositions = function(sel) {
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
		updatePatternSegmentHandlePositions(d3.select(this));

		d3.select(d.seg.this)
		.attr("d", function(d) {
			return d3.svg.line()(_.pluck(d.vertices.slice(d.curRange[0].idx, d.curRange[1].idx + 1), "coords"));
		});
	}
});

var drawPatternSegmentHandles = function(segmentList) {
	var handlesList = _.flatten(_.map(segmentList, function(seg) {
		return [{seg: seg, isStart: true, point: seg.curRange[0]}, {seg: seg, isStart: false, point: seg.curRange[seg.curRange.length - 1]}];
	}));
	assembleOptimizeCanvas.selectAll(".pattern-segment-handle").remove();
	var handles = assembleOptimizeCanvas.selectAll(".pattern-segment-handle").data(handlesList)
	.enter()
	.append("circle")
	.classed("pattern-segment-handle clickable", true)
	.attr("r", 5)
	.on("mouseover", function(d) {
		d3.select(this).attr("r", 6);
	})
	.on("mouseout", function(d) {
		d3.select(this).attr("r", 5);
	})
	.call(patternSegmentDrag);

	return updatePatternSegmentHandlePositions(handles);
};

var bindToNextBtn = function(f) {
	nextOptimizeBtn.on("click", f);
};

var constraintHandler = function(constraintConstructor) {
	return function() {
		setupOptimizeOverlay();
		d3.select(".svg-instruction-bar").classed("hidden", false);
		d3.selectAll(".constraint-btns .btn").classed("disabled", true);
		d3.selectAll("path.pattern-segment").classed("selectable", true);
		assembleSvgOptimizeLabel.text("Select two segments to make parallel.");
		var selectedSegments = [];
		bindToNextBtn(function() {
			if (selectedSegments.length === 0) {
				bootbox.alert("Please select two segments by clicking on them.");
			} else if (selectedSegments.length !== 2) {
				bootbox.alert("Please select exactly two segments.");
			} else {
				d3.selectAll("path.pattern-segment").classed("selectable", false)
				.on("click", null);
				assembleSvgOptimizeLabel.text("Select points to vary during optimization.");
				var handles = assembleOptimizeCanvas.selectAll(".pattern-segment-handle")
				.on(".drag", null)
				.on("click", function(d) {
					d.point.isActive = !d.point.isActive;
					d3.select(this).classed("selected", d.point.isActive);
				});
				bindToNextBtn(function() {
					assembleOptimizeCanvas.selectAll(".pattern-segment-handle")
					.classed("clickable", false);
					d3.selectAll(".pattern-segment.selected")
					.classed("pattern-segment selected", false)
					.classed("pattern-segment-fixed", true);
					d3.selectAll(".pattern-segment-handle")
					.classed("pattern-segment-handle", false)
					.classed("pattern-segment-handle-fixed", true);
					exitConstraintSelection();
					var segCopies = _.clone(selectedSegments);
					_.map(segCopies, function(seg) {
						seg.vertices = [seg.startIdx + seg.curRange[0].idx, seg.startIdx + seg.curRange[1].idx];
						if (!seg.curRange[0].isActive && !seg.curRange[1].isActive) {
							seg.fix = "both";
						} else if (!seg.curRange[0].isActive) {
							seg.fix = "first";
						} else if (!seg.curRange[1].isActive) {
							seg.fix = "second";
						} else {
							seg.fix = null;
						}
					});
					console.log(segCopies);
					optimizationConstraints.push(constraintConstructor.apply(constraintConstructor, _.map(segCopies, makeSegment)));
					redrawConstraintList();
					bindToNextBtn(null);
				});
			}
		});
		assembleOptimizeCanvas.selectAll(".pattern-segment")
		.on("click", patternSelectHandler(selectedSegments));
	};
};

var exitConstraintSelection = function() {
	assembleOptimizeCanvas.selectAll(".pattern-segment, .pattern-segment-handle").remove();
	d3.select(".svg-instruction-bar").classed("hidden", true);
	d3.selectAll(".constraint-btns .btn").classed("disabled", false);
};

var addParallelConstraint = function(segs) {
};

var optimizationConstraints = [];

var highlightNodes = function(nodes) {
	d3.selectAll(".pattern-segment-fixed, .pattern-segment-handle-fixed")
	.classed("highlighted", true)
	.classed("hidden", function(d) {
		return !(_.find(nodes, function(n) {
			return n === (d.this || d.seg.this);
		}));
	});
};

var resetHighlightNodes = function() {
	d3.selectAll(".pattern-segment-fixed, .pattern-segment-handle-fixed")
	.classed("hidden highlighted", false);
};

var deleteNodes = function(nodes) {
	d3.selectAll(".pattern-segment-fixed, .pattern-segment-handle-fixed")
	.filter(function(d) {
		return (_.find(nodes, function(n) {
			return n === (d.this || d.seg.this);
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
// stay in custom land first
// make pattern update pipeline completely functional under customTemplates
// get objective function


// convert star / rosette / extended / hankin -> equivalent custom pattern
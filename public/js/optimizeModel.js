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

	var draw = function(params) {
		var element = getElement();
		var pattern = element.tile.patterns[patternIdx];
		if (element.tile.segments) {
			element.tile.segments.push([pattern.intersectedVertices[v1], pattern.intersectedVertices[v2]]);
		} else {
			element.tile.segments = [[pattern.intersectedVertices[v1], pattern.intersectedVertices[v2]]];
		}
		var segmentGroup = d3.select(element.tile.this).selectAll(".segment")
		.data(function(d) { return d.segments; })
		.enter()
		.append("g")
		.classed("segment", true);

		segmentGroup
		.append("path")
		.style("stroke", params.color || "blue")
		.attr("d", function(d) {
			return d3.svg.line()(_.pluck(d, "coords"));
		});

		if (params && params.highlightHandle) {
			var previousHandleIndexInIntersectedVertices = _.findLast(
				element.pattern.intersectedVertices, function(v,i) {
				return i <= v1 && (!v.intersect || i === 0);
			});
			var nextHandleIndexInIntersectedVertices = _.find(
				element.pattern.intersectedVertices, function(v, i) {
				return i >= v2 && (!v.intersect || i === element.pattern.intersectedVertices.length - 1);
			});
			var handles = [previousHandleIndexInIntersectedVertices, nextHandleIndexInIntersectedVertices];
			if (fix === "first") {
				handles = [handles[1]];
			} else if (fix === "second") {
				handles = [handles[0]];
			} else if (fix === "both") {
				handles = [];
			}

			handles = _.filter(handles, function(h, idx) {
				return h !== element.pattern.intersectedVertices[0] &&
				h !== _.last(element.pattern.intersectedVertices);
			});

			segmentGroup
			.selectAll(".segmentHandle").data(handles).enter()
			.append("circle")
			.attr("cx", function(d) { return d.coords[0]; })
			.attr("cy", function(d) { return d.coords[1]; })
			.attr("r", 3)
			.attr("fill", "red");
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
		draw: draw,
		getElement: getElement,
		getCoords: getCoords,
		getInterface: getInterface
	};
};

var enforceConstructor = function(evaluateConstructor) {
	return function(seg1, seg2) {
		var evaluateFn = evaluateConstructor(seg1, seg2);
		return {
			evaluate: evaluateFn,
			segments: [seg1, seg2],
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
});

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
});

var enforceEqualLength = enforceConstructor(function(seg1, seg2) {
	return function() {
		var len1 = num.norm2(num.vectorFromEnds(seg1.getCoords()));
		var len2 = num.norm2(num.vectorFromEnds(seg2.getCoords()));
		return Math.abs(len1 - len2);
	};
});

var createObjectives = function(objectives) {
	var evaluate = function(i) {
		var evaluatedValues = _.map(objectives, function(f) { return f.evaluate(); });
		return _.reduce(evaluatedValues,function(a,b) { return a + b; });
	};
	var getInterface = function() {
		var segments = _.flatten(_.map(objectives, function(o) { return o.segments; }));
		var interfaces = _.flatten(_.map(segments, function(s) { return s.getInterface(); }));
		// TODO: have a better uniqWith by updating to lodashv4
		return _.uniq(interfaces, JSON.stringify);
	};

	var draw = function() {
		d3.selectAll(".tile").each(function(d) {
			delete d.segments;
		});
		d3.selectAll(".segment").remove();
		var includedSegments = _.flatten(_.map(objectives, function(o) { return o.segments; }));
		var excludedSegments = _.flatten(_.map(objectives, function(o) { return _.difference(o.allSegments, o.segments); }));

		_.each(excludedSegments, function(s, idx) {
			s.draw({color: "darkblue", highlightHandle: false});
		});

		_.each(includedSegments, function(s, idx) {
			s.draw({color: "blue", highlightHandle: true});
		});
	};

	return {
		evaluate: evaluate,
		getInterface: getInterface,
		draw: draw
	};
};

// basic example
// var o = createObjectives([enforceEqualLength(makeSegment(0,1,0,0,1), makeSegment(0,0,0,0,1))])
// optimizer(o,1000)

var optimizer = function(objectives) {
	objectives.draw();

	var customInterface = objectives.getInterface();
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
		return updateCustomTemplates(vector, customInterface, objectives);
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
	objectives.draw();

	return result;
};

var updateCustomTemplates = function(vector, customInterface, objectives) {
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
		var value = objectives.evaluate() + _.sum(_.map(tiles, getRepulsionForce));
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

// 		patternFn = makePatterns(_.last(patternOptions).generator(tile));
// 		polygonAddPattern(tile, patternFn);
// 		patternEditSVGDrawer.redrawPatterns(true);

// 	var tilesInCanvas = assembleCanvas.selectAll("g.tile").filter(function(d, i) { return d.polygonID === newTile.polygonID; });

// 	tilesInCanvas.each(function(d, i) {
// 		d3.select(this).selectAll("path.pattern").remove();
// 		d.customTemplate = _.cloneDeep(newTile.customTemplate);
// 		var patterns = motif.generator(d, patternSlider1.getValue(), patternSlider2.getValue());
// 		polygonAddPattern(d, makePatterns(patterns));
// 		d.patternParams = _.cloneDeep(newTile.patternParams);
// 		polygonAddPatternMetadata(d);
// 		drawPatterns(d3.select(this), {});
// 	});


// input is:
// 	{polygonID: [{
// 		customTemplate: [
// 			{points: [[11, 13], [-50,30]]},
// 			{points: [[11, 13], [-50,30]]}
// 		]
// 	}]}



// output is:
// 	set new points in custom template
// 	patternUpdate() <- remove reliance on patternEditSVGDrawer
// 	updateTileWithPatternClick() <- for each tile
// 	update canvas (optimize "tilesInCanvas")


// // num.vectorFromEnds
// // num.norm2
// // num.getAngle.apply(null, )

// stay in custom land first
// make pattern update pipeline completely functional under customTemplates
// get objective function


// convert star / rosette / extended / hankin -> equivalent custom pattern
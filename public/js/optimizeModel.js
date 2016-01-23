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

var makeSegment = function(groupIdx, tileIdx, patternIdx, v1, v2, toChange) {
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
		if (toChange === "first") {
			handles = [handles[0]];
		} else if (toChange === "second") {
			handles = [handles[1]];
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
			return [{
				polygonID: element.tile.polygonID,
				isCustom: false
			}];
		} else {
			console.log(patternType);
			throw new Error("Optimization is unsupported for this pattern type.");
		}
	};

	return {
		getElement: getElement,
		getCoords: getCoords,
		getInterface: getInterface
	};
};

var enforceConstructor = function(evaluateConstructor) {
	return function(seg1, seg2, toChange) {
		var evaluateFn = evaluateConstructor(seg1, seg2);
		var segments;
		if (toChange === "first") {
			segments = [seg1];
		} else if (toChange === "second") {
			segments = [seg2];
		} else {
			// by default
			segments = [seg1, seg2];
		}
		return {
			evaluate: evaluateFn,
			segments: segments
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

var enforceEqualLength = enforceConstructor(function(seg1, seg2) {
	return function() {
		var len1 = num.norm2(num.vectorFromEnds(seg1.getCoords()));
		var len2 = num.norm2(num.vectorFromEnds(seg2.getCoords()));
		return Math.abs(len1 - len2);
	};
});

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

	return {
		evaluate: evaluate,
		getInterface: getInterface
	};
};

// basic example
// var o = createObjectives([enforceEqualLength(makeSegment(0,1,0,0,1), makeSegment(0,0,0,0,1))])
// optimizer(o,1000)

var optimizer = function(objectives) {
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

	var result = optimjs.minimize_Powell(fnc, initialVector);

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
		var value = objectives.evaluate() + _.sum(_.map(assembleSVGDrawer.get(), getRepulsionForce));
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
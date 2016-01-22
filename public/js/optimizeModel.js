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

var makeSegment = function(groupIdx, tileIdx, patternIdx, v1, v2) {
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
				handles = [previousHandleIndexInCustomTemplate];
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
		return {
			polygonID: element.tile.polygonID,
			handles: _.filter(handles, function(i) { return i >= 0 && i < numHandles; })
		};
	};

	var getPolygonID = function() {
		return getElement().tile.polygonID;
	};

	var getTile = function() {
		return getElement().tile;
	};

	return {
		getElement: getElement,
		getCoords: getCoords,
		getPatternHandles: getPatternHandles
	};
};

var enforceParallel = function(seg1, seg2) {
	var evaluate = function() {
		var v1 = num.vectorFromEnds(seg1.getCoords());
		var v2 = num.vectorFromEnds(seg2.getCoords());
		var cosOfAngle = num.dot(v1,v2) / (num.norm2(v1) * num.norm2(v2));
		return Math.acos(Math.abs(cosOfAngle));
	};
	return {
		evaluate: evaluate,
		segments: [seg1, seg2]
	};
};

var enforceEqualLength = function(seg1, seg2) {
	var evaluate = function() {
		var len1 = num.norm2(num.vectorFromEnds(seg1.getCoords()));
		var len2 = num.norm2(num.vectorFromEnds(seg2.getCoords()));
		return Math.abs(len1 - len2);
	};
	return {
		evaluate: evaluate,
		segments: [seg1, seg2]
	};
};

var createObjectives = function(objectives) {
	var evaluate = function() {
		var evaluatedValues = _.map(objectives, function(f) { return f.evaluate(); });
		return _.reduce(evaluatedValues,function(a,b) { return a + b; });
	};
	var getInterface = function() {
		var segments = _.flatten(_.map(objectives, function(o) { return o.segments; }));
		var tiles = _.uniq(_.map(segments, function(s) { return s.getElement().tile; }));
		var customInterface = _.map(tiles, function(t) {
			return {
				polygonID: t.polygonID,
				customTemplate: _.map(t.customTemplate, function(ct) {
					return {optimizePts: []};
				})
			};
		});
		_.each(segments, function(s) {
			var polyInterface = _.find(customInterface, function(ci) {
				return ci.polygonID === s.getElement().tile.polygonID;
			});
			var customTemplate = polyInterface.customTemplate[s.getElement().pattern.customIndex];
			customTemplate.optimizePts = _.uniq(customTemplate.optimizePts.concat(s.getPatternHandles().handles));
		});
		return customInterface;
	};

	return {
		evaluate: evaluate,
		getInterface: getInterface
	};
};

// basic example
// var o = createObjectives([enforceEqualLength(makeSegment(0,1,0,0,1), makeSegment(0,0,0,0,1))])
// optimizer(o,1000)

var optimizer = function(objectives, maxIterations) {
	var customInterface = objectives.getInterface();
	var initialVector = _.flattenDeep(_.map(customInterface, function(tile) {
		var fullTile = _.find(assembleSVGDrawer.get(), function(t) {
			return t.polygonID === tile.polygonID;
		});
		return _.map(tile.customTemplate, function(ct, ctIdx) {
			return _.map(ct.optimizePts, function(idx) {
				return num.getTranslation(fullTile.customTemplate[ctIdx].points[idx].transform);
			});
		});
	}));
	var numIterations = 0;
	var fnc = function(vector) {
		numIterations ++;
		if (numIterations >= maxIterations) {
			return 0;
		}
		return updateCustomTemplates(vector, customInterface, objectives);
	};

	var result = optimjs.minimize_Powell(fnc, initialVector);

	var tilesInCanvas = assembleCanvas.selectAll("g.tile");

	tilesInCanvas.each(function(d, i) {
		if (d.customTemplate) {
			var modelTile = _.find(assembleSVGDrawer.get(), function(t) {
				return t.polygonID === d.polygonID;
			});
			d3.select(this).selectAll("path.pattern").remove();
			d.customTemplate = _.cloneDeep(modelTile.customTemplate);
			d.patterns = modelTile.patterns;
			console.log(d.customTemplate[0], d.patterns);
			var patternFn = _.last(patternOptions).generator(d);
			polygonAddPattern(d, makePatterns(patternFn));
			console.log(d.customTemplate[0], d.patterns);
			d.patternParams = _.cloneDeep(modelTile.patternParams);
			polygonAddPatternMetadata(d);
			drawPatterns(d3.select(this), {});
		}
	});

	invalidateStripCache();

	return result;
};

var updateCustomTemplates = function(vector, customInterface, objectives) {
	var coords = _.chunk(vector, 2);
	if (_.all(customInterface, function(tileInterface) {
		var tile = _.find(assembleSVGDrawer.get(), function(t) {
			return t.polygonID === tileInterface.polygonID;
		});
		if (tile.customTemplate.length !== tileInterface.customTemplate.length) {
			console.error("Input custom template has a different number of custom patterns");
			return false;
		}
		var intersectedVertexInterface = _.map(tile.patterns, function(p) {
			return _.pluck(p.intersectedVertices, "intersect");
		});
		_.each(tile.customTemplate, function(t, idx) {
			_.each(tileInterface.customTemplate[idx].optimizePts, function(ptIdx) {
				t.points[ptIdx] = {transform: num.translate.apply(null, coords.splice(0, 1))};
			});
		});
		patternFn = makePatterns(_.last(patternOptions).generator(tile));
		polygonAddPattern(tile, patternFn);
		polygonAddPatternMetadata(tile);

		// console.log(getRepulsionForce(tile));

		// compare pattern intersections with the previous interface
		// only proceed if it is the same
		if (_.all(tile.patterns, function(p, idx) {
			var newIntersectData = _.pluck(p.intersectedVertices, "intersect");
			var eq = _.isEqual(newIntersectData,
				intersectedVertexInterface[idx]);
			return eq;
		})) {
			assembleSVGDrawer.replace(tile);
			return true;
		} else {
			return false;
		}
	})) {
		assembleSVGDrawer.draw();
		var value = objectives.evaluate() + _.sum(_.map(assembleSVGDrawer.get(), getRepulsionForce));
		return value;
	} else {
		console.log("HERE");
		assembleSVGDrawer.draw();
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
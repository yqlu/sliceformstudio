var drawIntersectedVertices = function() {
	assembleCanvas.selectAll(".tile")
	.each(function(d) {
		var tile = this;
		d3.select(this).selectAll("circle.intersected")
		.data(function(d) { return _.flatten(_.pluck(d.patterns, "intersectedVertices")); })
		.enter()
		.append("circle")
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
		var pattern = tile.patterns[patternIdx];
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
			num.coordsToMatrix(element.patternCoords))));
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

	return {
		getCoords: getCoords,
		getPatternHandles: getPatternHandles
	};
};

var enforceParallel = function(seg1, seg2) {
	return function() {
		var v1 = num.vectorFromEnds(seg1());
		var v2 = num.vectorFromEnds(seg2());
		var cosOfAngle = num.dot(v1,v2) / (num.norm2(v1) * num.norm2(v2));
		return Math.acos(Math.abs(cosOfAngle));
	};
};

var enforceEqualLength = function(seg1, seg2) {
	return function() {
		var len1 = num.norm2(num.vectorFromEnds(seg1()));
		var len2 = num.norm2(num.vectorFromEnds(seg2()));
		return Math.abs(len1 - len2);
	};
};

var createObjectives = function(objectives) {
	return function() {
		var evaluatedValues = _.map(objectives, function(f) { return f(); });
		return _.reduce(evaluatedValues,function(a,b) { return a + b; });
	};
};

var optimizer = function(objectives, maxIterations) {
	var customInterface = _.map(assembleSVGDrawer.get(), function(tile) {
		return {
			polygonID: tile.polygonID,
			customTemplate: tile.customTemplate ?
				_.map(tile.customTemplate, function(ct) {
					return {numPoints: ct.points.length};
				}) : []
		};
	});
	var initialVector = _.flattenDeep(_.map(assembleSVGDrawer.get(), function(tile) {
		return _.map(tile.customTemplate, function(ct) {
			return _.map(ct.points, function(pt) {
				return num.getTranslation(pt.transform);
			});
		});
	}));
	var vectorToTemplateConverter = createVectorToTemplateConverter(customInterface);
	var numIterations = 0;
	var fnc = function(vector) {
		numIterations ++;
		if (numIterations >= maxIterations) {
			return 0;
		}
		var newTemplate = vectorToTemplateConverter(vector);
		return updateCustomTemplates(newTemplate, objectives);
	};
	return optimjs.minimize_Powell(fnc, initialVector);
};

var createVectorToTemplateConverter = function(customInterface) {
	var expectedNumberOfCoords = _.reduce(_.map(customInterface, function(poly) {
		return _.reduce(_.pluck(poly.customTemplate, "numPoints"), function(a,b) {
			return a + b;
		});
	}), function(a,b) { return a + b; });
	return function(vector) {
		var coords = _.chunk(vector, 2);
		if (expectedNumberOfCoords !== coords.length) {
			throw new Error("Wrong number of coords provided: "+ expectedNumberOfCoords + " vs " + coords.length);
		}
		var newTemplate = _.cloneDeep(customInterface);
		_.each(newTemplate, function(polygon) {
			_.each(polygon.customTemplate, function(ct) {
				ct.points = coords.splice(0, ct.numPoints);
			});
		});
		return newTemplate;
	};
};

var updateCustomTemplates = function(newTiles, objectives) {
	if (_.all(newTiles, function(newTile) {
		var tile = _.find(assembleSVGDrawer.get(), function(t) {
			return t.polygonID === newTile.polygonID;
		});
		if (tile.customTemplate.length !== newTile.customTemplate.length) {
			console.error("Input custom template has a different number of custom patterns");
			return false;
		}
		var customTemplateBackup = _.cloneDeep(tile.customTemplate);
		var intersectedVertexInterface = _.map(tile.patterns, function(p) {
			return _.pluck(p.intersectedVertices, "intersect");
		});
		if (_.any(tile.customTemplate, function(t, idx) {
			return t.points.length !== newTile.customTemplate[idx].points.length;
		})) {
			console.error("Input custom template has a different number of points");
			return false;
		}
		_.each(tile.customTemplate, function(t, idx) {
			t.points = _.map(newTile.customTemplate[idx].points, function(p) {
				return {transform: num.translate.apply(null, p)};
			});
		});
		patternFn = makePatterns(_.last(patternOptions).generator(tile));
		polygonAddPattern(tile, patternFn);
		polygonAddPatternMetadata(tile);

		// compare pattern intersections with the previous interface
		// only proceed if it is the same
		if (_.all(tile.patterns, function(p, idx) {
			var newIntersectData = _.pluck(p.intersectedVertices, "intersect");
			return _.isEqual(newIntersectData,
				intersectedVertexInterface[idx]);
		})) {
			assembleSVGDrawer.replace(tile);
			return true;
		} else {
			return false;
		}
	})) {
		assembleSVGDrawer.draw();

		var tilesInCanvas = assembleCanvas.selectAll("g.tile");

		tilesInCanvas.each(function(d, i) {
			if (d.customTemplate) {
				var modelTile = _.find(assembleSVGDrawer.get(), function(t) {
					return t.polygonID === d.polygonID;
				});
				d3.select(this).selectAll("path.pattern").remove();
				d.customTemplate = _.cloneDeep(modelTile.customTemplate);
				d.patterns = modelTile.patterns;
				var patterns = _.last(patternOptions).generator(d);
				polygonAddPattern(d, makePatterns(patterns));
				d.patternParams = _.cloneDeep(modelTile.patternParams);
				polygonAddPatternMetadata(d);
				drawPatterns(d3.select(this), {});
			}
		});

		invalidateStripCache();

		var value = objectives();
		// console.log(value);
		return value;
	} else {
		return Infinity;
	}
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
var cropData = {
	vertices: [],
	hull: []
};

var setupCropOverlay = function() {
	assembleCropOverlay.style("visibility", "visible");
	assembleCropCanvas.style("visibility", "visible");

	var vertexCoords = assembleCanvas.selectAll(".vertex")[0]
	.map(function(d) {
		var coords = num.coordsToMatrix([[d.__data__.x, d.__data__.y]]);
		var transformedCoords = num.matrixToCoords(num.dot(num.dot(d.parentNode.parentNode.__data__.transform,
			d.parentNode.__data__.transform), coords))[0];
		return {x: transformedCoords[0], y: transformedCoords[1], correspondsTo: d};
	});

	var edgeCoords = assembleCanvas.selectAll(".edge")[0]
	.map(function(d) {
		var coords = num.coordsToMatrix([num.edgeCenter(d.__data__.ends)]);
		var transformedCoords = num.matrixToCoords(num.dot(num.dot(d.parentNode.parentNode.__data__.transform,
			d.parentNode.__data__.transform), coords))[0];
		return {x: transformedCoords[0], y: transformedCoords[1], correspondsTo: d};
	});

	var interiorCoords = assembleCanvas.selectAll(".tile")[0]
	.map(function(d) {
		var coords = num.coordsToMatrix([[0,0]]);
		var transformedCoords = num.matrixToCoords(num.dot(num.dot(d.parentNode.__data__.transform,
			d.__data__.transform), coords))[0];
		return {x: transformedCoords[0], y: transformedCoords[1], correspondsTo: d};
	});

	var coords = vertexCoords.concat(edgeCoords).concat(interiorCoords);

	assembleCropCanvas.selectAll("circle.crop-vertex").remove();
	var vertices = assembleCropCanvas.selectAll("circle.crop-vertex")
	.data(coords);

	vertices.enter()
	.append("circle")
	.classed("crop-vertex", true)
	.attr("cx", function(d) {return d.x;})
	.attr("cy", function(d) {return d.y;})
	.attr("r", 5)
	.each(function(d, i) {
		d.this = this;
	})
	.classed("selected", function(d) {
		return _.any(cropData.vertices, function(v) {
			return v.correspondsTo === d.correspondsTo;
		});
	})
	.on("click", cropCircleClick);

	// since vertices may overlap, make sure selected vertices appear on top
	_.each(vertices.filter(".selected")[0], function(selected) {
		$(selected.parentNode).append(selected);
	});

	cropData.vertices = _.filter(coords, function(v1) {
		return _.find(cropData.vertices, function(v2) {
			return v1.correspondsTo === v2.correspondsTo;
		});
	});

	recomputeHull();

	vertices.exit().remove();
};

var teardownCropOverlay = function() {
	assembleCropOverlay.style("visibility", "hidden");
	assembleCropCanvas.style("visibility", "hidden");
};

var recomputeHull = function() {
	var line = d3.svg.line()
	.x(function(d) { return d.x; })
	.y(function(d) { return d.y; })
	.interpolate("linear-closed");

	cropData.hull = convexHull(cropData.vertices);
	cropData.hullEdges = _.map(cropData.hull, function(x, idx) {
		return (idx === 0) ?
			[_.last(cropData.hull), cropData.hull[0]] :
			[cropData.hull[idx - 1], cropData.hull[idx]];
	});

	assembleCropCanvasPathOverlay
	.datum(cropData.hull)
	.attr("d", function(d) { return d.length > 0 ? line(d) + "Z" : ""; });
};

var insideBbox = function(bboxCorners, line) {
	return  (bboxCorners[0].x < line[0][0] && line[0][0] < bboxCorners[1].x) &&
			(bboxCorners[0].x < line[1][0] && line[1][0] < bboxCorners[1].x) &&
			(bboxCorners[0].y < line[0][1] && line[0][1] < bboxCorners[2].y) &&
			(bboxCorners[0].y < line[1][1] && line[1][1] < bboxCorners[2].y);
};

var generateInRegionPredicate = function(transform) {

	var vs = num.matrixToCoords(num.dot(transform, num.coordsToMatrix(_.map(cropData.hull, function(v) {
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

var generateDummyEdge = function(dummyEdges, bboxCorners, bboxEdges, lineSegment) {

	if (_.any(bboxEdges, function(edge) {
		return Intersection.intersectLineLine(edge[0], edge[1],
			{x: lineSegment[0][0], y: lineSegment[0][1]},
			{x: lineSegment[1][0], y: lineSegment[1][1]}).status !== "No Intersection";
	}) || (insideBbox(bboxCorners, lineSegment))) {
		dummyEdges.push({
			ends: lineSegment,
			joinedTo: null,
			length: num.norm2(num.vectorFromEnds(lineSegment)),
			patterns: []
		});
	}
};

var findDummyIntersections = function(lineSegment, dummyEdges) {
	return _.map(dummyEdges, function(dummyEdge) {
		var lineSegment2 = [{x: dummyEdge.ends[0][0], y: dummyEdge.ends[0][1]},
			{x: dummyEdge.ends[1][0], y: dummyEdge.ends[1][1]}];
		var intersection = Intersection.intersectLineLine(lineSegment[0], lineSegment[1],
				lineSegment2[0], lineSegment2[1]);

		if (intersection.status === "Close Intersection") {
			intersection.status = "Intersection";
			intersection.points = intersection.points2;
		}
		return {edge: dummyEdge, segment: lineSegment2,
			intersection: intersection
		};
	});
};

var findBestIntersection = function(lineSegment, dummyEdges) {
	var dummyIntersections = findDummyIntersections(lineSegment, dummyEdges);

	var results = _.chain(dummyIntersections)
		.filter(function(obj) {
			return obj.intersection.status === "Intersection";
		}).sortBy(function(obj) {
			return obj.intersection.points[0].relative;
		}).value();
	return results[0];
};

var cropPattern = function(tile, parentGroup) {

	var dim = tile.dimensions;

	var dummyEdges = [];

	var maxDimEstimate = numeric.norm2([dim.height, dim.width]) / 2;

	var bboxCorners = [
		{x: - maxDimEstimate, y: - maxDimEstimate},
		{x: maxDimEstimate, y: - maxDimEstimate},
		{x: maxDimEstimate, y: maxDimEstimate},
		{x: - maxDimEstimate, y: maxDimEstimate}];

	var bboxEdges = _.map(bboxCorners, function(x, idx) {
		return (idx === 0) ? [_.last(bboxCorners), bboxCorners[0]] : [bboxCorners[idx - 1], bboxCorners[idx]];
	});

	var invTransform = num.inv(num.dot(parentGroup.transform, tile.transform));

	_.each(cropData.hullEdges, function(lineSegment) {
		var seg = [[lineSegment[0].x, lineSegment[0].y], [lineSegment[1].x, lineSegment[1].y]];
		var transformedLine = num.matrixToCoords(
			num.dot(invTransform, num.coordsToMatrix(seg)));
		generateDummyEdge(dummyEdges, bboxCorners, bboxEdges, transformedLine);
	});

	_.each(dummyEdges, function(e, i) {
		e.index = tile.edges.length + i;
	});

	var inRegion = generateInRegionPredicate(invTransform);

	if (dummyEdges.length > 0) {
		// for each pattern, crop with thresholds as necessary
		tile.patterns = _.flatten(_.map(tile.patterns, function(p) {
			var curInRegion = inRegion(p.allVertices[0]);
			var patterns = curInRegion ? [{
				start: p.start,
				end: null,
				internalVertices: [],
				assembleCounterpart: p.assembleCounterpart
			}] : [];

			for (var ctr = 1; ctr < p.allVertices.length; ctr ++) {
				var curSubpattern = _.last(patterns);

				var lineSegment = [{x:p.allVertices[ctr-1][0],y:p.allVertices[ctr-1][1]},
					{x:p.allVertices[ctr][0],y:p.allVertices[ctr][1]}];

				var result = findBestIntersection(lineSegment, dummyEdges);
				var cropPt = result && result.intersection && result.intersection.points[0];
				var cropEdge = result && result.edge;

				var nextPt = p.allVertices[ctr];
				var prevPt;
				if (curInRegion) {
					prevPt = _.last(curSubpattern.internalVertices) || curSubpattern.start.coords;
				} else {
					prevPt = p.allVertices[ctr-1];
				}

				var isLastPt = ctr === p.allVertices.length - 1;

				if (curInRegion) {
					if (inRegion(nextPt)) {
						if (isLastPt) {
							curSubpattern.end = p.end;
						} else {
							curSubpattern.internalVertices.push(p.allVertices[ctr]);
						}
					} else {
						console.assert(typeof result === "object", "If pattern is leaving region, some intersection with a cropped edge must be found.");
						// end the pattern at the border
						if (approxEqPoints(cropPt.coords, prevPt)) {
							if (curSubpattern.internalVertices.length === 0) {
								// pattern is only [prevPt, cropPt] but prevPt = cropPt
								// delete pattern
								patterns.splice(patterns.length - 1);
							} else {
								// pattern is [..., prevPt, cropPt] but prevPt = cropPt
								// splice out prevPt and set end to cropPt
								curSubpattern.internalVertices.splice(curSubpattern.internalVertices.length - 1);
								curSubpattern.end = {
									proportion: cropPt.relative2,
									coords: cropPt.coords,
									edge: cropEdge,
									index: cropEdge.index
								};
							}
						} else {
							curSubpattern.end = (isLastPt && (approxEqPoints(cropPt.coords, nextPt))) ?
								p.end : {
								proportion: cropPt.relative2,
								coords: cropPt.coords,
								edge: cropEdge,
								index: cropEdge.index
							};
						}
						curInRegion = false;
					}
				} else {
					var start, end;
					if (inRegion(nextPt)) {
						console.assert(typeof result === "object",
							"If pattern is entering region, some intersection with a cropped edge must be found.");
						// if cropPt = nextPt and nextPt is the last point, there is no pattern to add
						if (!(isLastPt && approxEqPoints(cropPt.coords, nextPt))) {
							// otherwise, push a pattern
							// starting at cropPt, unless cropPt = prevPt and prevPt is the first point
							// in which case take p.start
							start = ((ctr === 1) && approxEqPoints(cropPt.coords, prevPt)) ?
								p.start : {
								proportion: cropPt.relative2,
								coords: cropPt.coords,
								edge: cropEdge,
								index: cropEdge.index
							};

							// if this is the last point, set pattern.end and have no internal vertices
							// if cropPt = nextPt, exclude nextPt from internal vertices

							end = isLastPt ? p.end : null;
							var internalVertices = isLastPt || approxEqPoints(cropPt.coords, nextPt) ? [] : [nextPt];

							patterns.push({
								start: start,
								end: end,
								internalVertices: internalVertices,
								assembleCounterpart: p.assembleCounterpart
							});
						}
						curInRegion = true;
					} else {
						// both endpoints are out of the region, but line segment might still intersect
						// cropped region. hack - test if midpoint is in the region
						var midPt = num.edgeCenter([prevPt, nextPt]);
						if (inRegion(midPt)) {
							results = _.chain(findDummyIntersections(lineSegment, dummyEdges))
								.filter(function(obj) {
									return obj.intersection.status === "Intersection";
								}).sortBy(function(obj) {
									return obj.intersection.points[0].relative;
								}).value();

							// since region is convex, if midpoint is in region, line segment must intersect
							// region exactly twice
							console.assert(results.length === 2);

							var cropPt1 = results[0] && results[0].intersection && results[0].intersection.points[0];
							var cropEdge1 = results[0] && results[0].edge;
							var cropPt2 = results[1] && results[1].intersection && results[1].intersection.points[0];
							var cropEdge2 = results[1] && results[1].edge;

							start = (approxEqPoints(cropPt.coords, prevPt) && ctr === 1) ?
								p.start : {
								proportion: cropPt1.relative2,
								coords: cropPt1.coords,
								edge: cropEdge1,
								index: cropEdge1.index
							};

							end = (approxEqPoints(cropPt2.coords, nextPt) && isLastPt) ?
								p.end : {
								proportion: cropPt2.relative2,
								coords: cropPt2.coords,
								edge: cropEdge2,
								index: cropEdge2.index
							};

							patterns.push({
								start: start,
								end: end,
								internalVertices: [],
								assembleCounterpart: p.assembleCounterpart
							});
						}
					}
				}
			}

			_.each(patterns, function(p) {
				computePatternDataFromInternalVertices(p);
			});

			return patterns;
		}));

		_.each(tile.patterns, function(p, idx) {
			p.index = idx;
		});

		tile.edges.extend(dummyEdges);

		polygonAddPatternMetadata(tile);
		// rebuild pattern metadata

	} else {
		// tile is either completely in or completely out of cropped area
		if (!inRegion(tile.edges[0].ends[0])) {
			tile.patterns = [];
		}
	}
};

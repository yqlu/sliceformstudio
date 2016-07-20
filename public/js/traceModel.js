var longestStrip = 0;
var shortestSegment = Infinity;

// pick out all the pattern nodes from a patternTrace call
var nodePatternTrace = function(patternData) {
	return _.pluck(_.pluck(patternTrace(patternData), "pattern"), "this");
};

// given a pattern, trace out an array of contiguous patterns
var patternTrace = function(patternData) {

	var currPattern = patternData;
	var nextEdge = currPattern.end.edge;

	var traceEnd = patternUnidirectionalTrace(currPattern, nextEdge);

	var patternList = [{
		reverse: false,
		pattern: currPattern
	}].concat(traceEnd.patternList);

	if (!traceEnd.cycle) {
		var traceStart = patternUnidirectionalTrace(currPattern, currPattern.start.edge);
		_.map(traceStart.patternList, function(p) {
			p.reverse = !p.reverse;
		});
		patternList = traceStart.patternList.reverse().concat(patternList);
	}

	return {
		hasCycle: traceEnd.cycle,
		patternList: patternList
	};
};

// helper function in patternTrace: trace in one direction
var patternUnidirectionalTrace = function(patternData, nextEdge) {

	var currPattern = patternData;

	var patternList = [], cycle = false;

	while (nextEdge.joinedTo) {
		var selfPatternObject = _.find(nextEdge.patterns, function(p) {
			return p.pattern.this === currPattern.this;
		});

		var otherEdge = nextEdge.joinedTo.node.__data__;

		// only original edges (not dummy cropped edges) have pattern interfaces
		// but all edges we are tracing through .joinedTo are original edges
		// so we can assume they all have pattern interfaces

		var otherPatternIdentifier = _.min(_.filter(otherEdge.patternInterface, function(p) {
			return approxEq(p.proportion, 1 - selfPatternObject.proportion, config.proportionTolerance);
		}), function(p) {
			return Math.abs(p.angle - selfPatternObject.angle);
		});

		var otherPattern = _.find(otherEdge.patterns, function(p) {
			return approxEq(p.angle, otherPatternIdentifier.angle, config.anglesTolerance) &&
				approxEq(p.proportion, otherPatternIdentifier.proportion, config.proportionTolerance);
		});

		if (otherPatternIdentifier !== Infinity && typeof otherPattern === "undefined") {
			// pattern should have been mapped to another pattern
			// which has since been cropped away
			// quit the loop
			nextEdge = {};
		} else {

			if (typeof otherPattern === "undefined") {
				// no compatible pattern found, set up otherPattern
				// for shouldBeSelf === infinity and bouncing a few lines below
				otherPattern = {proportion: Infinity, angle: Infinity};
			}

			var shouldBeSelf = _.min(_.filter(nextEdge.patterns, function(p) {
				return approxEq(p.proportion, 1 - otherPattern.proportion, config.proportionTolerance);
			}), function(p) {
				return Math.abs(p.angle - otherPattern.angle);
			});

			if (shouldBeSelf === Infinity || shouldBeSelf.pattern.this !== selfPatternObject.pattern.this) {
				// unsuccessful crossing an edge
				// try bouncing instead

				var bouncePattern = _.find(nextEdge.patterns, function(p) {
					return p.pattern.this !== currPattern.this &&
						approxEq(p.proportion, selfPatternObject.proportion, config.proportionTolerance) &&
					// check that the pattern has not already been matched off
						p.pattern.this.parentNode !== null;
				});

				if (bouncePattern) {
					selfPatternObject.intersect = false;
					bouncePattern.intersect = false;

					// note that all instances of a tile share a reference to the same pattern object initially
					// when patterns are bounced, we need to mutate instances of the pattern
					// _.cloneDeep has poor performance, so here we shallow clone enough to change the necessary fields
					if (currPattern.start.edge.this === nextEdge.this) {
						currPattern.start = _.clone(currPattern.start);
						currPattern.intersectedVertices = _.clone(currPattern.intersectedVertices);
						currPattern.intersectedVertices[0] = _.clone(currPattern.intersectedVertices[0]);
						currPattern.start.intersect = false;
						currPattern.intersectedVertices[0].intersect = false;
					} else {
						currPattern.end = _.clone(currPattern.end);
						currPattern.intersectedVertices = _.clone(currPattern.intersectedVertices);
						currPattern.intersectedVertices[currPattern.intersectedVertices.length - 1] = _.clone(currPattern.intersectedVertices[currPattern.intersectedVertices.length - 1]);
						currPattern.end.intersect = false;
						_.last(currPattern.intersectedVertices).intersect = false;
					}
					if (bouncePattern.pattern.start.edge.this === nextEdge.this) {
						bouncePattern.pattern.start = _.clone(bouncePattern.pattern.start);
						bouncePattern.pattern.intersectedVertices = _.clone(bouncePattern.pattern.intersectedVertices);
						bouncePattern.pattern.intersectedVertices[0] = _.clone(bouncePattern.pattern.intersectedVertices[0]);
						bouncePattern.pattern.start.intersect = false;
						bouncePattern.pattern.intersectedVertices[0].intersect = false;
					} else {
						bouncePattern.pattern.end = _.clone(bouncePattern.pattern.end);
						bouncePattern.pattern.intersectedVertices = _.clone(bouncePattern.pattern.intersectedVertices);
						bouncePattern.pattern.intersectedVertices[bouncePattern.pattern.intersectedVertices.length - 1] = _.clone(bouncePattern.pattern.intersectedVertices[bouncePattern.pattern.intersectedVertices.length - 1]);
						bouncePattern.pattern.end.intersect = false;
						_.last(bouncePattern.pattern.intersectedVertices).intersect = false;
					}
					otherPattern = bouncePattern;
					otherEdge = nextEdge;
				} else {
					otherPattern  = null;
				}
			}

			if (otherPattern) {

				currPattern = otherPattern.pattern;

				var reverse;
				if (otherEdge === currPattern.start.edge) {
					nextEdge = currPattern.end.edge;
					reverse = false;
				} else {
					nextEdge = currPattern.start.edge;
					reverse = true;
				}

				if (currPattern.this === patternData.this) {
					// found a cycle! terminate
					cycle = true;
					nextEdge = {};
				} else {
					patternList.push({
						reverse: reverse,
						pattern: currPattern
					});
				}
			} else {
				nextEdge = {};
			}

		}
	}
	return {
		cycle: cycle,
		patternList: patternList
	};
};

// build a strip (array of arrays of lengths) based on a traced object
var buildStrip = function(traced) {

	var patternList = traced.patternList;

	var segs = _.map(patternList, function(p) {
		var intersectedSegments = p.pattern.this.__data__.intersectedSegments;
		if (p.reverse) {
			return _.map(_.cloneDeep(intersectedSegments), function(seg) {
				return seg.reverse();
			}).reverse();
		} else {
			return intersectedSegments;
		}
	});

	var builtSegments = _.cloneDeep(segs[0]);

	_.map(_.range(segs.length - 1), function(i) {
		var firstEdge = patternList[i].reverse ? patternList[i].pattern.start.edge : patternList[i].pattern.end.edge;
		var secondEdge = patternList[i+1].reverse ? patternList[i+1].pattern.end.edge : patternList[i+1].pattern.start.edge;
		var firstPatternObject = _.find(firstEdge.patterns, function(p) { return p.pattern.this === patternList[i].pattern.this; });
		var secondPatternObject = _.find(secondEdge.patterns, function(p) { return p.pattern.this === patternList[i+1].pattern.this; });
		console.assert(firstPatternObject.intersect === secondPatternObject.intersect,
			"Error: joined edges have conflicting intersection data.\n", firstPatternObject, secondPatternObject);
		console.assert(approxEq(firstPatternObject.proportion, (1 - secondPatternObject.proportion), config.proportionTolerance),
			"Error: joined edges have conflicting position data.\n", firstPatternObject, secondPatternObject);

		var nextSegment = _.cloneDeep(segs[i+1]);
		if (firstPatternObject.intersect) {
			_.last(builtSegments).extend(nextSegment[0]);
			nextSegment.shift();
			builtSegments = builtSegments.concat(nextSegment);
		} else if (approxEq(firstPatternObject.angle, secondPatternObject.angle, config.anglesTolerance)) {
			builtSegments[builtSegments.length - 1][builtSegments[builtSegments.length - 1].length - 1] += nextSegment[0][0];
			nextSegment[0].shift();
			_.last(builtSegments).extend(nextSegment[0]);
			nextSegment.shift();
			builtSegments = builtSegments.concat(nextSegment);
		} else {
			builtSegments = builtSegments.concat(nextSegment);
		}
	});

	if (traced.hasCycle) {
		var firstPattern = patternList[0];
		var lastPattern = patternList[patternList.length - 1];

		var firstEdge = firstPattern.reverse ? firstPattern.pattern.end.edge : firstPattern.pattern.start.edge;
		var lastEdge = lastPattern.reverse ? lastPattern.pattern.start.edge : lastPattern.pattern.end.edge;

		var firstPatternObject = _.find(firstEdge.patterns, function(p) { return p.pattern.this === firstPattern.pattern.this; });
		var lastPatternObject = _.find(lastEdge.patterns, function(p) { return p.pattern.this === lastPattern.pattern.this; });
		console.assert(firstPatternObject.intersect === lastPatternObject.intersect,
			"Error: joined edges have conflicting intersection data.\n", firstPatternObject, lastPatternObject);
		console.assert(approxEq(firstPatternObject.proportion, (1 - lastPatternObject.proportion), config.proportionTolerance),
			"Error: joined edges have conflicting position data.\n", firstPatternObject, lastPatternObject);

		if (firstPatternObject.intersect) {
			_.last(builtSegments).extend(_.cloneDeep(builtSegments[0]));
		} else {
			builtSegments.push(_.cloneDeep(builtSegments[0]));
		}
	}

	return builtSegments;
};

// return line generator for an up-down alternating line
// skips every other crossing
// used for drawing interlaced patterns
var altLineFromSegment = function(vertices, takeIntersect, isOutline) {
	var avg = isOutline ? function(x, y) {
		return 0.51 * x + 0.49 * y;
	} : function(x, y) {
		return 0.5 * (x+y);
	};

	var accumulator = ["M"+vertices[0].x+","+vertices[0].y];

	_.each(vertices, function(v, i) {
		var u;
		var isLast = (i === vertices.length - 1);
		if (takeIntersect && v.intersect) {
			takeIntersect = !takeIntersect;
			accumulator.push("L"+v.x+","+v.y);
			if (!isLast) {
				u = vertices[i+1];
				accumulator.push("L"+avg(v.x, u.x)+","+avg(v.y, u.y));
			}
		} else if (takeIntersect && !v.intersect) {
			if (!isLast) {
				accumulator.push("L"+v.x+","+v.y);
			}
			// push Ls
		} else if (!takeIntersect && v.intersect) {
			takeIntersect = !takeIntersect;
			if (!isLast) {
				u = vertices[i+1];
				accumulator.push("M"+avg(u.x, v.x)+","+avg(u.y, v.y));
			}
			// push an M after this vertex
		} else if (!takeIntersect && !v.intersect) {
			// do nothing
		}

	});
	return accumulator.join(" ");
};

var altLine = function(segments, takeIntersect, isOutline) {
	var avg = isOutline ? function(x, y) {
		return 0.51 * x + 0.49 * y;
	} : function(x, y) {
		return 0.5 * (x+y);
	};

	var intersectBool = takeIntersect;
	return _.map(segments, function(seg) {
		var numberOfFlips = _.filter(seg, "intersect").length;
		var generatedSeg = altLineFromSegment(seg, intersectBool, isOutline);
		// xor operator to pass correct parity of intersectBool into next altLine
		intersectBool = ( numberOfFlips % 2 === 0 ? !intersectBool : intersectBool );
		return generatedSeg;
	}).join(" ");
};

var everyOtherIntersect = function(segments, bool) {
	var i = 0;
	return _.flatten(_.map(segments, function(segment) {
		return _.filter(_.filter(segment, "intersect"), function(v,index) {
			if (i > 0 && index === 0) {
				// first vertex of new segment
				// same as last seen vertex, don't increment i
			} else {
				i += 1;
			}
			return (i%2 === (bool ? 1 : 0));
		});
	}), true);
};

var redrawCanvas = function() {
	longestStrip = 0;
	shortestSegment = Infinity;

	traceCanvas.selectAll("g.group").each(function(d) {
		d.overPoints = [];
		d.underPoints = [];
	});


	// initially strictMode is true
	// groupPattern returns false if a strip of correct parity is found, quitting out of the inner loop
	// groupPattern returns true if the strip has indeterminate parity
	// iterate through all the strips to find one that works (which will quit out of inner loop)
	// but if i == number of patterns, no strips work, so flip strictMode to false
	// i.e. groupPattern will figure out an arbitrary parity if parity is indeterminate
	while ($(traceCanvas.node()).find("path.pattern").length > 0) {
		var i = 0, strictMode = true;

		while (groupPattern($(traceCanvas.node()).find("path.pattern")[i].__data__, strictMode)) {
			i += 1;
			if (i === $(traceCanvas.node()).find("path.pattern").length) {
				i = 0;
				strictMode = false;
			}
		}
	}

	d3.selectAll(".strip-below")
	.each(function(d, i) {
		d.id = i;
	});
};

// effectively the same loop as redrawCanvas, but done for each tile
// performed as a check to make sure that individually tiles
// have patterns that can go over-under in the first place
var overUnderPerTile = function(tile) {
	var patterns = _.map(tile.patterns, function(p) {
		return [_.map(p.intersectedVertices, function(v) {
			return {x: v.coords[0], y: v.coords[1], intersect: v.intersect};
		})];
	});

	var overPoints = [];
	var underPoints = [];

	var assignAndEjectPattern = function(pattern, overPoints, underPoints, strictMode) {
		var res = determineOverUnder(pattern, overPoints, underPoints, strictMode);
		if (res.status === "ERROR") {
			var msg = "Error: unable to find consistent assignment of over and under.";
			throw msg;
		} else if (res.status === "INDETERMINATE") {
			return true;
		} else {
			patterns.splice(_.indexOf(patterns, pattern), 1);
			return false;
		}
	};

	try {
		while (patterns.length > 0) {
			var i = 0, strictMode = true;

			while (assignAndEjectPattern(patterns[i], overPoints, underPoints, strictMode)) {
				i += 1;
				if (i === patterns.length) {
					i = 0;
					strictMode = false;
				}
			}
		}
		return true;
	} catch (e) {
		return false;
	}
};

var groupPattern = function(patternData, strictMode) {

	var traced = patternTrace(patternData);
	var patternList = traced.patternList;

	var groupNode = patternData.this.parentNode.parentNode;

	var rawSegments = _.map(patternList, function(p, index) {
		var transform = p.pattern.this.parentNode.__data__.transform;

		var transformedVertices = _.map(p.pattern.intersectedVertices, function(obj) {
			var ans = num.dot(transform, obj.coords.concat([1]));
			return {intersect: obj.intersect, x: ans[0], y: ans[1]};
		});

		if (p.reverse) {
			transformedVertices.reverse();
		}

		return transformedVertices;
	});

	var reducedSegments = _.reduce(rawSegments, function(acc, newSeg, idx) {
		if (idx === 0) {
			return [newSeg];
		} else {
			var firstPtOfNewSeg = [_.head(newSeg).x, _.head(newSeg).y];
			var lastPtOfOldSeg = [_.last(_.last(acc)).x, _.last(_.last(acc)).y];
			if (approxEqPoints(firstPtOfNewSeg, lastPtOfOldSeg)) {
				_.last(acc).extend(_.tail(newSeg));
			} else {
				acc.push(newSeg);
			}
			return acc;
		}
	}, []);

	if (traced.hasCycle) {
		var firstPt = reducedSegments[0][0];
		var lastPt = _.last(_.last(reducedSegments));
		var seamIsContinuous = approxEqPoints([firstPt.x, firstPt.y], [lastPt.x, lastPt.y]);
		if (seamIsContinuous) {
			// duplicate first for last for smooth display
			_.last(reducedSegments).push(_.cloneDeep(_.first(reducedSegments)[1]));
		}
	}

	var extendedEnd = false, extendedStart = false;

	// extend start and end segments as appropriate

	if (_.last(_.last(reducedSegments)).intersect && !traced.hasCycle) {
		var finalPts = _.takeRight(_.last(reducedSegments),2);
		var finalCoord = [finalPts[1].x, finalPts[1].y];
		var finalVector = [finalPts[1].x - finalPts[0].x, finalPts[1].y - finalPts[0].y];
		var finalExtension = num.vecSum(finalCoord, num.vecProd(num.normalize(finalVector), extensionSlider.getValue() * config.sidelength));
		_.last(reducedSegments).push({
			intersect: false,
			x: finalExtension[0],
			y: finalExtension[1]
		});
		extendedEnd = true;
	}

	if (_.first(_.first(reducedSegments)).intersect && !traced.hasCycle) {
		var initialPts = _.first(_.take(reducedSegments),2);
		var initialCoord = [initialPts[0].x, initialPts[0].y];
		var initialVector = [initialPts[0].x - initialPts[1].x, initialPts[0].y - initialPts[1].y];
		var initialExtension = num.vecSum(initialCoord, num.vecProd(num.normalize(initialVector), extensionSlider.getValue() * config.sidelength));
		_.first(reducedSegments).unshift({
			intersect: false,
			x: initialExtension[0],
			y: initialExtension[1]
		});
		extendedStart = true;
	}

	// assign over and under
	var overPoints = groupNode.__data__.overPoints;
	var underPoints = groupNode.__data__.underPoints;

	// boolean determined in next block,
	// used for drawing in alt-line
	var direction;

	var res = determineOverUnder(reducedSegments, overPoints, underPoints, strictMode);
	if (res.status === "ERROR") {
		console.debug(overPoints, underPoints, traced, reducedSegments[0]);
		var msg = "Error: unable to find consistent assignment of over and under.";
		bootbox.alert(msg);
		throw msg;
	} else if (res.status === "INDETERMINATE") {
		return true;
	} else {
		direction = res.direction;
	}

	// construct lines corresponding to over and under
	var overOutline = d3.select(groupNode).append("path")
					.classed("strip-outline", true)
					.attr("d", function() {
						return altLine(reducedSegments, direction, true);
					}).node();
	var overStrip = d3.select(groupNode).append("path")
					.classed("strip strip-above", true)
					.attr("d", function() {
						return altLine(reducedSegments, direction, false);
					}).node();
	var underStrip = d3.select(groupNode).insert("path", ":first-child")
					.classed("strip strip-below", true)
					.attr("d", function() {
						return _.map(reducedSegments, function(seg) {
							return line(seg);
						}).join(" ");
					}).node();
	var underOutline = d3.select(groupNode).insert("path", ":first-child")
					.classed("strip-outline", true)
					.attr("d", underStrip.getAttribute("d")).node();

	overStrip.__data__ = {outline: overOutline, points: reducedSegments};
	underStrip.__data__ = {outline: underOutline, points: reducedSegments};

	d3.selectAll([overOutline, underOutline]).attr("stroke-linejoin", "miter").style("stroke-width", thicknessSlider.getValue()+1);

	var strip = buildStrip(traced);

	if (extendedStart) {
		_.first(strip).unshift(extensionSlider.getValue() * config.sidelength);
	}
	if (extendedEnd) {
		_.last(strip).push(extensionSlider.getValue() * config.sidelength);
	}

	shortestSegment = Math.min(shortestSegment, _.min(_.map(strip, function(s) { return _.min(s); })));
	longestStrip = Math.max(longestStrip,
		_.reduce(_.map(strip, function(s) {
			return _.reduce(s, function(a,b) { return a + b; });
		}), function(a,b) { return a + b; }));

	// update min and max here

	d3.selectAll([overStrip, underStrip])
	.attr("stroke-linejoin", "miter")
	.style("stroke-width", thicknessSlider.getValue())
	.on("mouseover", function() {
		d3.selectAll([overStrip, underStrip]).classed("hover", true);
	}).on("mouseout", function() {
		d3.selectAll([overStrip, underStrip]).classed("hover", false);
	})
	.on("click", function() {
		var selectedColor = $("#spectrum").spectrum('get').toHexString();
		assignStripColor([overStrip, underStrip], strip, selectedColor, _.pluck(traced.patternList, "pattern"));
		updateStripTable();
	});

	_.each(_.pluck(traced.patternList, "pattern"), function(p) {
		p.assembleCounterpart.assignStripColor = function(color) {
			assignStripColor([overStrip, underStrip], strip, color, _.pluck(traced.patternList, "pattern"));
			updateStripTable();
		};
		p.assembleCounterpart.isStripAssigned = function() {
			return d3.select(overStrip).attr("assignedColor");
		};
	});

	underStrip.__data__ = underStrip.__data__ || {};
	underStrip.__data__.updateExtension = function(newLength) {
		// update reducedSegments and strip properly
		if (extendedEnd) {
			var finalExtension = num.vecSum(finalCoord, num.vecProd(num.normalize(finalVector), newLength * config.sidelength));
			var lastSegment = _.last(reducedSegments);
			lastSegment[lastSegment.length - 1] = {
				intersect: false,
				x: finalExtension[0],
				y: finalExtension[1]
			};
			_.last(strip)[_.last(strip).length - 1] = newLength * config.sidelength;
		}

		if (extendedStart) {
			var initialExtension = num.vecSum(initialCoord, num.vecProd(num.normalize(initialVector), newLength * config.sidelength));
			var firstSegment = _.first(reducedSegments);
			firstSegment[0] = {
				intersect: false,
				x: initialExtension[0],
				y: initialExtension[1]
			};
			_.first(strip)[0] = newLength * config.sidelength;
		}

		d3.select(overOutline).attr("d", function() {
			return altLine(reducedSegments, direction, true);
		});
		d3.select(overStrip).attr("d", function() {
			return altLine(reducedSegments, direction, false);
		});
		d3.select(underStrip).attr("d", function() {
			return _.map(reducedSegments, function(seg) {
				return line(seg);
			}).join(" ");
		});
		d3.select(underOutline).attr("d", underStrip.getAttribute("d"));
	};

	var groupedNodes = _.pluck(_.pluck(patternList, "pattern"), "this");
	d3.selectAll(groupedNodes).remove();

	return false; // successful, quit out of loop
};

// returns {direction: bool, status: "SUCCESS" / "INDETERMINATE" / "ERROR"
// success: assigned over/under correctly
// indeterminate: try again later, currently underdefined
// error: overconstrained, no possible assignment
var determineOverUnder = function(reducedSegments, overPoints, underPoints, strictMode) {

	var direction;
	if (overPoints.length === 0) {
		// easy step: no constraints, so just arbitrarily assign over and under
		direction = true;
		overPoints.extend(everyOtherIntersect(reducedSegments, true));
		underPoints.extend(everyOtherIntersect(reducedSegments, false));
	} else {
		// check over and under
		var potentialOverPoints = everyOtherIntersect(reducedSegments, true);
		if (_.any(potentialOverPoints, function(p1) {
			return _.any(overPoints, function(p2) {
				return approxEq(p1.x, p2.x) && approxEq(p1.y, p2.y);
		});})) {
			// cannot go in over; put in under;
			if (_.any(potentialOverPoints, function(p1) {
				return _.any(underPoints, function(p2) {
					return approxEq(p1.x, p2.x) && approxEq(p1.y, p2.y);
				});
			})) {
				// unable to find consistent assignment of over and under
				// fail
				return {status: "ERROR"};
			}
			direction = false;
			overPoints.extend(everyOtherIntersect(reducedSegments, false));
			underPoints.extend(potentialOverPoints);
		} else {
			if (strictMode && !_.any(potentialOverPoints, function(p1) {
				return _.any(underPoints, function(p2) {
					return approxEq(p1.x, p2.x) && approxEq(p1.y, p2.y);
				});
			})) {
				// current pattern does not intersect existing patterns at all
				// adding it to list may result in future contradictions
				return {status: "INDETERMINATE"}; // Try next element
			}
			direction = true;
			overPoints.extend(potentialOverPoints);
			underPoints.extend(everyOtherIntersect(reducedSegments, false));
		}
	}
	return {status: "SUCCESS", direction: direction};
};

var emphasizeStrips = function(nodes, color) {
	d3.selectAll(".strip").style("stroke", "gainsboro");
	d3.selectAll(".strip-outline").style("stroke-width", 0);
	d3.selectAll(nodes).style("stroke", color);
	d3.selectAll(_.map(nodes, function(n) { return n.__data__.outline; })).style("stroke-width", thicknessSlider.getValue() + 1);
};

var colorAllStrips = function() {
	_.each(colorMap, function(c) {
		d3.selectAll(_.flatten(_.pluck(c.strips, "nodes"))).style("stroke", c.color.hex);
	});
	d3.selectAll(".strip-outline").style("stroke-width", thicknessSlider.getValue() + 1);
};

var getStripParameters = function() {
	return {
		stripHeight: stripHeight.getValue(),
		widthFactor: widthFactor.getValue(),
		interSpacing: interSpacing.getValue(),
		printWidth: printWidth.getValue(),
		printHeight: printHeight.getValue()
	};
};

var getSvgBlob = function() {
	var xmlPrefix = "<?xml version='1.0' encoding='utf-8'?>";
	genSVG(stripSvgInput, _.merge(getStripParameters(), {
		selector: "#tmpSvg",
		resetTransform: true,
		forDisplay: false
	}));
	var svg = d3.select("#tmpSvg").select("svg").node();
	var serializer = new XMLSerializer();
	return new Blob([xmlPrefix + serializer.serializeToString(svg)], {type: "image/svg+xml"});
};

var stripSvgSliderChange = function() {
	genSVG(stripSvgInput, _.merge(getStripParameters(), {
		selector: "#stripCutSvg",
		resetTransform: false,
		forDisplay: true
	}));
};


var downloadStripsClick = function(d, filename) {
	stripSvgInput = _.pluck(d.strips, "lengths");
	$("#stripFilename").val(filename || currentFilename + "_" + d.color.id + ".svg").focus();
	genSVG(stripSvgInput, _.merge(getStripParameters(), {
		selector: "#stripCutSvg",
		resetTransform: true,
		forDisplay: true
	}));
	// recompute widthFactor
	widthFactor.setValue(widthFactor.getValue());
	$("#downloadStripModal").modal("show");
	d3.select("#downloadStripConfirm")
	.on("click", function() {
		saveAs(getSvgBlob(), $("#stripFilename").val());
		$("#downloadStripModal").modal("hide");
	});
};

// update display for strip table
var updateStripTable = function() {
	var collapsedColorSlots = _.filter(colorMap, function(c) {
		return d3.select("#collapse" + c.color.id)[0][0] &&
		d3.select("#collapse" + c.color.id).style("display") === "none";
	});

	var update = sidebarForm
	.selectAll("div.color-slot")
	.data(colorMap);

	noneSoFar.style("display", "none");
	resetAllStrips.style("display", "block");

	update.enter().append("div").classed("color-slot", true);

	update.exit().remove();

	// on Firefox the drag-update of a list item fires off mouseover and mouseout events
	// on previously adjacent nodes. Use mostRecentDrag to only action mouseover and mouseout
	// events that are > 100ms after the end of a drag update.
	var mostRecentDrag = new Date(0);

	update.html("").append("a")
	.classed("pull-right btn btn-primary btn-xs", true).style("margin-right", "10px")
	.on("click", function(d) {
		downloadStripsClick(d);
	})
	.append("i").classed("fa fa-download fa-fw", true);
	update.append("h5").classed("colorLabel", true)
	.attr("id", function(d) { return "collapser" + d.color.id; })
	.html(function(d) {
		var caret = _.contains(collapsedColorSlots, d) ? "fa-caret-right" : "fa-caret-down";
		return "<i class='fa fa-fw fa-caret-down'></i> <span>" + d.color.name + " (" + d.strips.length + ")</span>";
	})
	.each(function(d) {
		$("#collapser" + d.color.id).click(function() {
			var collapseDiv = d3.select("#collapse" + d.color.id);
			if (collapseDiv.style("display") === "block") {
				// collapse
				collapseDiv.style("display", "none");
				d3.select(this).select("i").classed("fa-caret-right", true).classed("fa-caret-down", false);
			} else {
				// open up
				collapseDiv.style("display", "block");
				d3.select(this).select("i").classed("fa-caret-down", true).classed("fa-caret-right", false);
			}
		});
	})
	.on("mouseover", function(d) {
		if (new Date() - mostRecentDrag > 100) {
			emphasizeStrips(_.flatten(_.pluck(d.strips, "nodes")), d.color.hex);
		}
	})
	.on("mouseout", function() {
		if (new Date() - mostRecentDrag > 100) {
			colorAllStrips();
		}
	});

	var collapseDiv = update.append("div").style("display", function(d) {
		return _.contains(collapsedColorSlots, d) ? "none" : "block";
	}).attr("id", function(d) { return "collapse" + d.color.id; })
		.append("ul").classed("strip-table-ul", true);

	collapseDiv.each(function(d) {
		d3.select(this).selectAll("li").data(d.strips)
		.enter().append("li").classed("strip-table-li", true)
		.style("cursor", "drag")
		.html(function(d, i) { return "<a class='strip-table-x' href='#'><i class='fa fa-times'></i></a> Strip #" +
			(d.nodes[0].__data__.id || d.nodes[1].__data__.id); })
		.on("mouseover", function(d1) {
			if (new Date() - mostRecentDrag > 100) {
				emphasizeStrips(d1.nodes, this.parentNode.__data__.color.hex);
			}
		})
		.on("mouseout", function() {
			if (new Date() - mostRecentDrag > 100) {
				colorAllStrips();
			}
		});

		d3.select(this).selectAll("li").selectAll("a")
		.on("click", function(d) {
			var parentArray = this.parentNode.parentNode.parentNode.__data__.strips;
			var thisStrip = this.parentNode.__data__;
			var thisStripIndex = _.findIndex(parentArray, function(s) {
				return s === thisStrip;
			});
			parentArray.splice(thisStripIndex, 1);
			if (parentArray.length === 0) {
				d3.select(this.parentNode.parentNode.parentNode.parentNode).remove();
			} else {
				d3.select(this.parentNode.parentNode.parentNode.parentNode).select(".colorLabel")
				.select("span").text(function(d) { return d.color.name + " (" + d.strips.length + ")"; });
				d3.select(this.parentNode).remove();
			}
			d3.selectAll(thisStrip.nodes).style("stroke", "gainsboro");
			colorAllStrips();
		});
	});
	$(".strip-table-ul").sortable({
		connectWith: 'strip-table-ul',
		hoverClass: 'hovered-li'
	}).bind('sortupdate', function(e, ui) {
		var startParentArray = ui.startparent[0].__data__.strips;
		var endParentArray = ui.endparent[0].__data__.strips;
		startParentArray.splice(ui.oldElementIndex, 1);
		endParentArray.splice(ui.elementIndex, 0, ui.item[0].__data__);
		d3.select(ui.endparent[0].parentNode.parentNode).select(".colorLabel")
		.select("span").text(function(d) { return d.color.name + " (" + d.strips.length + ")"; });
		if (ui.startparent[0].__data__.strips.length === 0) {
			d3.select(ui.startparent[0].parentNode.parentNode).remove();
		} else {
			d3.select(ui.startparent[0].parentNode.parentNode).select(".colorLabel")
			.select("span").text(function(d) { return d.color.name + " (" + d.strips.length + ")"; });
		}
		mostRecentDrag = new Date();
		emphasizeStrips(ui.item[0].__data__.nodes, ui.endparent[0].__data__.color.hex);
	});
};

var validateStripFormat = function(strips) {
	var isNonEmptyArray = function(p) {
		return p instanceof Array && p.length > 0;
	};

	return isNonEmptyArray(strips) && _.every(strips, function(strip) {
		return isNonEmptyArray(strip) && _.every(strip, function(segment) {
			return isNonEmptyArray(segment) && _.every(segment, function(space) {
				return typeof space === "number";
			});
		});
	});
};

var generateCustomStrip = function() {
	var stripData = JSON.parse(d3.select("#customStripJson").node().value);
	if (validateStripFormat(stripData)) {
		stripSvgInput = stripData;
		downloadStripsClick({strips: _.map(stripData, function(d) { return {lengths: d}; })}, "custom.svg");
	} else {
		console.error("Invalid strip format: ", stripData);
		bootbox.alert({
			title: "Error",
			message: "<p>Unable to parse input as strip:</p><pre>" + d3.select("#customStripJson").node().value + "</pre><p>Please see <a href='docs.html#jsonStripGen' target='_blank'>the docs</a> for more details on the format required.</p>"
		});
	}
};

// assign color to relevant strip
var assignStripColor = function(nodes, strip, color, patternList) {
	d3.selectAll(nodes).style("stroke", color).attr("assignedColor", true);

	// add to colorMap if doesn't exist
	if (_.all(colorMap, function(c) {
		return c.color.hex !== color;
	})) {
		var colorString = color.substring(1);
		// use name from strip colors if it exists
		// otherwise custom color, use hex as name
		var exists = _.find(flatColorPalette, function(c) {
			return c.hex === colorString.toUpperCase();
		});
		colorMap.push({color: {hex: color, name: (exists ? exists.name : color), id: colorString}, strips:[]});
	}

	_.each(colorMap, function(c) {
		if (c.color.hex !== color) {
			_.remove(c.strips, function(strip) {
				return strip.nodes[0] === nodes[0] || strip.nodes[0] === nodes[1];
			});
		} else if (!_.find(c.strips, function(strip) { return strip.nodes[0] === nodes[0] || strip.nodes[0] === nodes[1]; })) {
			c.strips.push({
				lengths: strip,
				nodes: nodes,
				patternList: patternList
			});
			_.each(nodes, function(n) {
				n.__data__.colorMapPtr = _.last(c.strips);
			});
		}
	});
};
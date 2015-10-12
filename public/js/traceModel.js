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

		var otherEdge = nextEdge.joinedTo.__data__;

		var otherPattern = _.min(_.filter(otherEdge.patterns, function(p) {
			return approxEq(p.proportion, 1 - selfPatternObject.proportion, config.polygonTolerance);
		}), function(p) {
			return Math.abs(p.angle - selfPatternObject.angle);
		});

		var shouldBeSelf = _.min(_.filter(nextEdge.patterns, function(p) {
			return approxEq(p.proportion, 1 - otherPattern.proportion, config.polygonTolerance);
		}), function(p) {
			return Math.abs(p.angle - otherPattern.angle);
		});

		if (shouldBeSelf === Infinity || shouldBeSelf.pattern.this !== selfPatternObject.pattern.this) {
			// unsuccessful crossing an edge
			// try bouncing instead

			var bouncePattern = _.find(nextEdge.patterns, function(p) {
				return p.pattern.this !== currPattern.this && p.proportion === selfPatternObject.proportion
				// check that the pattern has not already been matched off
					&& p.pattern.this.parentNode !== null;
			});

			if (bouncePattern) {
				selfPatternObject.intersect = false;
				bouncePattern.intersect = false;

				if (currPattern.start.edge.this === nextEdge.this) {
					currPattern.start.intersect = false;
					currPattern.intersectedVertices[0].intersect = false;
				} else {
					currPattern.end.intersect = false;
					_.last(currPattern.intersectedVertices).intersect = false;
				}
				if (bouncePattern.pattern.start.edge.this === nextEdge.this) {
					bouncePattern.pattern.start.intersect = false;
					bouncePattern.pattern.intersectedVertices[0].intersect = false;
				} else {
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
		console.assert(firstPatternObject.proportion === (1 - secondPatternObject.proportion),
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
		builtSegments.push(_.cloneDeep(builtSegments[0]));
	}

	return builtSegments;
};

// return line generator for an up-down alternating line
// skips every other crossing
// used for drawing interlaced patterns
var altLine = function(vertices, takeIntersect, isOutline) {
	var avg = isOutline ? function(x, y) {
		return 0.51 * x + 0.49 * y;
	} : function(x, y) {
		return 0.5 * (x+y);
	};

	var accumulator = ["M"+vertices[0].x+","+vertices[0].y];

	_.each(vertices, function(v, i) {
		var isLast = (i === vertices.length - 1);
		if (takeIntersect && v.intersect) {
			takeIntersect = !takeIntersect;
			accumulator.push("L"+v.x+","+v.y);
			if (!isLast) {
				var u = vertices[i+1];
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
				var u = vertices[i+1];
				accumulator.push("M"+avg(u.x, v.x)+","+avg(u.y, v.y));
			}
			// push an M after this vertex
		} else if (!takeIntersect && !v.intersect) {
			// do nothing
		}

	});
	return accumulator.join(" ");
};

var everyOtherIntersect = function(vertices, bool) {
	return _.filter(_.filter(vertices, "intersect"), function(v,index) {
		return !!(index%2) === bool;
	});
};

var overPoints = [];
var underPoints = [];


var redrawCanvas = function() {

	overPoints = [];
	underPoints = [];
	while ($(traceCanvas.node()).find("path.pattern").length > 0) {
		var i = 0, strictMode = true;
		while (groupPattern($(traceCanvas.node()).find("path.pattern")[i].__data__, strictMode)) {
			i += 1;
			if (i == $(traceCanvas.node()).find("path.pattern").length) {
				i = 0;
				strictMode = false;
			}
		}
	}
};


var groupPattern = function(patternData, strictMode) {

	var traced = patternTrace(patternData);
	var patternList = traced.patternList;

	var allVertices = _.flatten(_.map(patternList, function(p, index) {
		var truncate = (index !== patternList.length - 1);
		var transform = num.dot(p.pattern.this.parentNode.parentNode.__data__.transform,
			p.pattern.this.parentNode.__data__.transform);
		var transformedVertices = _.map(p.pattern.intersectedVertices, function(obj) {
			var ans = num.dot(transform, obj.coords.concat([1]));
			return {intersect: obj.intersect, x: ans[0], y: ans[1]};
		});

		if (p.reverse) {
			transformedVertices.reverse();
		}

		return truncate ? _.initial(transformedVertices) : transformedVertices;
	}), true);

	if (traced.hasCycle) {
		// duplicate first for last
		allVertices.push(_.cloneDeep(allVertices[1]));
	}

	var extendedEnd = false, extendedStart = false;

	// extend start and end segments as appropriate

	if (_.last(allVertices).intersect && !traced.hasCycle) {
		var finalPts = _.last(allVertices,2);
		var finalCoord = [finalPts[1].x, finalPts[1].y];
		var finalVector = [finalPts[1].x - finalPts[0].x, finalPts[1].y - finalPts[0].y];
		var finalExtension = num.vecSum(finalCoord, num.vecProd(num.normalize(finalVector), extensionSlider.getValue() * config.sidelength));
		allVertices.push({
			intersect: false,
			x: finalExtension[0],
			y: finalExtension[1]
		});
		extendedEnd = true;
	}

	if (_.first(allVertices).intersect && !traced.hasCycle) {
		var initialPts = _.first(allVertices,2);
		var initialCoord = [initialPts[0].x, initialPts[0].y];
		var initialVector = [initialPts[0].x - initialPts[1].x, initialPts[0].y - initialPts[1].y];
		var initialExtension = num.vecSum(initialCoord, num.vecProd(num.normalize(initialVector), extensionSlider.getValue() * config.sidelength));
		allVertices.unshift({
			intersect: false,
			x: initialExtension[0],
			y: initialExtension[1]
		});
		extendedStart = true;
	}

	// assign over and under
	if (overPoints.length === 0) {
		// easy step: no constraints, so just arbitrarily assign over and under
		var direction = true;
		overPoints.extend(everyOtherIntersect(allVertices, true));
		underPoints.extend(everyOtherIntersect(allVertices, false));
	} else {
		// check over and under
		var potentialOverPoints = everyOtherIntersect(allVertices, true);
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
				return true; // ERROR: try next element
			}
			var direction = false;
			overPoints.extend(everyOtherIntersect(allVertices, false));
			underPoints.extend(potentialOverPoints);
		} else {
			if (strictMode && !_.any(potentialOverPoints, function(p1) {
				return _.any(underPoints, function(p2) {
					return approxEq(p1.x, p2.x) && approxEq(p1.y, p2.y);
				});
			})) {
				// current pattern does not intersect existing patterns at all
				// adding it to list may result in future contradictions
				return true; // ERROR: try next element
			}
			var direction = true;
			overPoints.extend(potentialOverPoints);
			underPoints.extend(everyOtherIntersect(allVertices, false));
		}
	}

	// construct lines corresponding to over and under
	var overOutline = traceCanvas.append("path").classed("strip-outline", true).attr("d", function() { return altLine(allVertices, direction, true); }).node();
	var overStrip = traceCanvas.append("path").classed("strip strip-above", true).attr("d", function() { return altLine(allVertices, direction, false); }).node();
	var underStrip = traceCanvas.insert("path", ":first-child").classed("strip strip-below", true).attr("d", function() { return line(allVertices); }).node();
	var underOutline = traceCanvas.insert("path", ":first-child").classed("strip-outline", true).attr("d", underStrip.getAttribute("d")).node();

	d3.selectAll([overOutline, underOutline]).attr("stroke-linejoin", "miter").style("stroke-width", thicknessSlider.getValue()+1);

	d3.selectAll([overStrip, underStrip])
	.attr("stroke-linejoin", "miter")
	.style("stroke-width", thicknessSlider.getValue())
	.on("mouseover", function() {
		d3.selectAll([overStrip, underStrip]).classed("hover", true);
	}).on("mouseout", function() {
		d3.selectAll([overStrip, underStrip]).classed("hover", false);
	})
	.on("click", function() {
		assignStripColor([overStrip, underStrip], traced, extendedStart, extendedEnd, $("#colorpicker").val());
		updateStripTable();
	});

	var groupedNodes = _.pluck(_.pluck(patternList, "pattern"), "this");
	d3.selectAll(groupedNodes).remove();

	return false; // successful, quit out of loop
};

// update display for strip table
var updateStripTable = function() {
	var update = d3.select("#stripTable form")
	.selectAll("div.form-group")
	.data(colorMap);

	d3.select("#noneSoFar").style("display", "none");

	update.enter().append("div").classed("form-group", true);

	update.filter(function(d) { return d.strips.length === 0; })
	.remove();

	update.html(function(d) {
		return "<label class='control-label col-md-2'> " + d.color.name + " (" + d.strips.length + (d.strips.length > 1 ? " strips)" : " strip)") + "</div>";
	})
	.append("div")
	.classed("col-md-2", true)
	.append("a")
	.classed("btn btn-default btn-sm", true)
	.style("margin-left", "15px")
	.on("click", function(d) {
		genSVG(_.pluck(d.strips, "lengths"), {
			stripHeight: stripHeight.getValue(),
			widthFactor: widthFactor.getValue(),
			interSpacing: interSpacing.getValue(),
			printWidth: printWidth.getValue(),
			printHeight: printHeight.getValue()
		});
		var svg = d3.select("#stripSvg").select("svg").node();
		var serializer = new XMLSerializer();
		var pom = d3.select("#downloadLink").node();
		var bb = new Blob([serializer.serializeToString(svg)], {type: "image/svg+xml"});
		pom.download = d.color.name+".svg";
		pom.href = window.URL.createObjectURL(bb);
		pom.dataset.downloadurl = ["image/svg+xml", pom.download, pom.href].join(':');
		pom.click();
		d3.select(svg).remove();
	}).text("Generate SVG");
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
		genSVG(stripData, {
			stripHeight: stripHeight.getValue(),
			widthFactor: widthFactor.getValue(),
			interSpacing: interSpacing.getValue(),
			printWidth: printWidth.getValue(),
			printHeight: printHeight.getValue()
		});

		var svg = d3.select("#stripSvg").select("svg").node();
		var serializer = new XMLSerializer();
		var pom = document.createElement('a');
		pom.setAttribute('href', 'data:image/xvg+xml;charset=utf-8,' + serializer.serializeToString(svg));
		pom.setAttribute('download', "custom.svg");
		pom.click();
		d3.select(svg).remove();
	} else {
		console.error("Invalid strip format: ", stripData);
	}
};

// assign color to relevant strip
var assignStripColor = function(nodes, tracedObj, extendedStart, extendedEnd, color) {
	var strip = buildStrip(tracedObj);

	if (extendedStart) {
		_.first(strip).unshift(extensionSlider.getValue() * config.sidelength);
	}
	if (extendedEnd) {
		_.last(strip).push(extensionSlider.getValue() * config.sidelength);
	}

	d3.selectAll(nodes).style("stroke", color);

	_.each(colorMap, function(c) {
		if (c.color.hex !== color) {
			_.remove(c.strips, function(strip) {
				return strip.nodes[0] === nodes[0] || strip.nodes[0] === nodes[1];
			});
		} else if (!_.find(c.strips, function(strip) { return strip.nodes[0] === nodes[0] || strip.nodes[0] === nodes[1]; })) {
			c.strips.push({
				lengths: strip,
				nodes: nodes,
			});
		}
	});
};
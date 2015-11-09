// drag handler for translation, attached to top level g element
var dragMove = d3.behavior.drag()
.origin(function() {
	return {x: 0, y: 0};
})
.on("drag", function(d,i) {
	// update x y coordinates
	d.transform = num.translateBy(d.transform, d3.event.dx, d3.event.dy);
	d3.select(this).attr("transform", num.getTransform);
})
.on("dragstart", function(d, i) {
	// ui updates
	d3.select(this).moveToFront();
	d3.select(this).classed("translucent", true);

	d.startTime = new Date().getTime();

	// if edge is under cursor, save it into global var hover
	var hoveredNode = d3.select(".hover").node();
	if (hoveredNode) {
		hover = {
			node: hoveredNode,
			time: (new Date()).getTime()
		};
	}
	// prevent pointer events from trickling
	d3.event.sourceEvent.stopPropagation();
	d3.select(this).attr('pointer-events', 'none');
})
.on("dragend", function(d, i) {
	// restore ui
	d3.select(this).classed("translucent", false);
	d3.select(this).attr('pointer-events', '');

	var isClick = (new Date()).getTime() - d.startTime < config.clickThreshold;

	// enter canvas if hover group originates from palette
	if (!isClick && this.parentNode === assemblePaletteContainer.node()) {
		enterCanvas(this);
		selection.clear();
	}

	if (hover) {
		d3.select(hover.node).classed("hover", false);

		// mouse was over an edge or an interior during the drag

		switch (hover.node.tagName) {
		// click/drag on an edge
		case 'line':
			if (candidate && !d3.select(hover.node).classed("joined")) {
				// edge dragged onto another edge
				// equivalent to clicking both edges in quick succession
				selection.clear();
				edgeClick(hover.node);
				edgeClick(candidate);
			} else if (isClick) {
				selection.clear("group");
				edgeClick(hover.node);
			} else {
				selection.clear();
			}
			break;
		// click/drag on an interior
		case 'path':
			if (hover.node.classList.contains("interior") && isClick) {
				var isReclick = selection.clear();
				selection.set(hover.node.parentNode.parentNode, {type: "group",
					isReclick: isReclick});
			}
			break;
		}
	}
	hover = null;
	checkRep();
});

// drag handler for rotation, attached to vertex element
var dragRotate = d3.behavior.drag()
.on("drag", function(d,i) {
	// update rotation
	var angle = num.getAngle(d3.event.x, d3.event.y) - num.getAngle(d.x, d.y);
	d3.select(this.parentNode.parentNode)
	.attr("transform", function(d) {
		d.transform = num.rotateBy(d.transform, angle);
		return num.getTransform(d);
	});
})
.on("dragstart", function() {
	d3.select("body")
	.style("cursor", "all-scroll");
	d3.event.sourceEvent.stopPropagation();
	centerCoords(this.parentNode);
})
.on("dragend", function() {
	d3.select("body")
	.style("cursor", "auto");
});

// drag handler for editing shape, attached to vertex element
var dragEdit = d3.behavior.drag()
.on("drag", function(d,i) {
	updateVertexAndEdgeEnds(d, i);
})
.on("dragstart", function(d, i) {
	d3.select("body")
	.style("cursor", "all-scroll");
})
.on("dragend", function(d, i) {
	d3.select("body")
	.style("cursor", "auto");

	updateDimensions(this.parentNode.__data__);
});

var updateUIForCustomTemplate = function(template, forceFlag) {
	if (template === null || typeof template === "undefined") {
		resetCustomPatternUIValues();
	} else {
		// if forceFlag is true, always update the UI (applicable for patternDropdown on change)
		// if forceFlag is false, only update UI if thisTemplate is not selected
		// (applicable for switching values when dragging a different pattern handle)
		var tile = template.this.parentNode.__data__;
		var thisIndex = _.findIndex(tile.customTemplate, function(t) { return t === template; });

		if (forceFlag ||
			($("#customPatternSelect").val() && $("#customPatternSelect").val().length === 1 &&
			$("#customPatternSelect").val()[0] !== ""+thisIndex)) {

			$("#customPatternSelect").val(thisIndex);
			$(":radio[value=" + template.edgesSpec + "]").prop("checked", true);
			$(":radio[value=" + template.symmetrySpec + "]").prop("checked", true);
			$("#patternInterval").val(template.patternInterval);
			$("#patternStart").val(template.startEdge);
			$("#patternDepth").val(template.patternDepth);
			$("#manualEdges").val(JSON.stringify(template.applicableEdges));
			startOffset.setValue(template.startProportion - 0.5);
			endOffset.setValue(template.endProportion - 0.5);
			degreesOfFreedom.setValue(template.points.length);
		}
		d3.select(template.this.parentNode).selectAll("g.patternHelper").classed("active", false);
		d3.select(template.this).classed("active", true);
	}
};

var resetCustomPatternUIValues = function() {
	$("#customPatternSelect").val(0);
	$(":radio[value=auto]").prop("checked", true);
	$(":radio[value=mirrorCrop]").prop("checked", true);
	$("#patternInterval").val(2);
	$("#patternStart").val(0);
	$("#patternDepth").val(2);
	$("#manualEdges").val("");
	startOffset.setValue(0);
	endOffset.setValue(0);
	degreesOfFreedom.setValue(1);
};

// drag handler for editing custom pattern handles
var dragPatternHandleEdit = d3.behavior.drag()
.on("dragstart", function(d, i) {
	updateUIForCustomTemplate(d.this.parentNode.__data__, false);
})
.on("drag", function(d, i) {
	// sometimes d3.event.dx and d3.event.dy abruptly return a huge value, which I don't understand
	// hard cap drag functionality to work only if they have reasonable values
	if (d3.event.dx < 25 && d3.event.dy < 25) {
		d.transform = num.translateBy(d.transform, d3.event.dx, d3.event.dy);
		d3.select(d.this).attr("transform", num.getTransform);
		var tile = d.this.parentNode.parentNode.__data__;
		patternFn = makePatterns(_.last(patternOptions).generator(tile));
		polygonAddPattern(tile, patternFn);
		patternEditSVGDrawer.redrawPatterns(true);
	} else {
		console.error("d3.event.dx/dy too abruptly large: ", d3.event);
	}
});

// zoom handler for canvas
var zoomBehavior = function(d, i) {
	d3.select(this.parentNode).selectAll(".canvas").each(function(d) {
		d.transform = num.translateBy(num.scaleBy(num.id, d3.event.scale), d3.event.translate[0], d3.event.translate[1]);
	})
	.attr("transform", num.getTransform);
};

// zoom handler for palette, only enable y panning
var zoomPalette = d3.behavior.zoom()
.on("zoom", function(d, i) {
	var ty = zoomPalette.translate()[1];

	ty = Math.min(ty, 0);
	if (config.standardHeight < assemblePaletteContainer.node().getBBox().height + 2 * config.sidebarSpacing) {
		ty = Math.max(ty, config.standardHeight - assemblePaletteContainer.node().getBBox().height - 2 * config.sidebarSpacing);
	} else {
		ty = Math.max(ty, 0);
	}
	// ty = Math.max(ty, )
	zoomPalette.translate([0, ty]);

	assemblePaletteContainer.each(function(d) {
		d.transform = num.translateBy(d.scaledTransform, 0, zoomPalette.translate()[1]);
	})
	.attr("transform", num.getTransform);
});

// click handler for joining edges, attached to edge element
var edgeClick = function(thisNode) {
	// if other edge already exists
	if (selection.get() && selection.get().type === "edge") {
		if (thisNode === selection.get().edgeNode) {
			selection.clear();
		} else {
			joinEdges(thisNode, selection.get());
			selection.clear();
		}
	} else if (d3.select(thisNode).classed("joined")) {
		breakEdges(thisNode);
		selection.clear();
	} else {
		selection.set(thisNode, {type: "edge"});
	}
};

// select the group
var groupClick = function(d, i) {
	selection.clear();
	selection.set(this, {type: "group"});
};

// mouseover handler for edge handle node
var handleMouseover = function(edgeNode) {
	if (hover && edgeNode !== hover.node && !d3.select(edgeNode).classed("joined")) {
		candidate = edgeNode;
	}
	d3.selectAll([edgeNode, edgeNode.__data__.joinedTo]).classed('hover', true);
};

// mouseout handler for edge handle node
var handleMouseout = function(edgeNode) {
	candidate = null;
	if (!hover || (edgeNode !== hover.node)) {
		d3.selectAll([edgeNode, edgeNode.__data__.joinedTo]).classed('hover', false);
	}
};

// clicking a pattern
var patternClick = function(thisNode) {
	assignStripColor(thisNode, $("#colorpicker").val());
	updateStripTable();
};

var shapeDropdownChange = function(a, b, c, d, e) {
	var index = shapeDropdown.node().value;
	var currentOption = shapeOptions[index];
	assembleSVGDrawer.set(currentOption.polygons());
	assembleSVGDrawer.draw();

	if (currentOption.name === "Custom") {
		$("#customShape").collapse("show");
	} else {
		$("#customShape").collapse("hide");
	}

	selection.clear();
};

var shapeEditCustomDraw = function() {
	shapeEditSVGDrawer.set([regularPolygon(parseInt(sideNumberSlider.getValue(), 10), parseFloat(sideLengthSlider.getValue()))]);
	shapeEditSVGDrawer.draw();
};

var patternDropdownChange = function() {

	var index = patternDropdown.node().value;
	var motif = patternOptions[index];
	var tile = patternEditSVGDrawer.getTile();

	var n = tile.vertices.length;

	if (motif.parameters.length === 2) {
		// regular motif option with parameters
		d3.selectAll("#presets").style("display", "block");
		d3.selectAll("#inferText").style("display", "none");
		d3.selectAll("#customPattern").style("display", "none");
		patternSlider1.destroy();
		patternSlider2.destroy();

		d3.select("#patternLabel1").text(motif.parameters[0].name);
		patternSlider1 = new Slider("#patternSlider1", motif.parameters[0].options(n))
		.on("change", patternUpdate);

		d3.select("#patternLabel2").text(motif.parameters[1].name);
		patternSlider2 = new Slider("#patternSlider2", motif.parameters[1].options(n))
		.on("change", patternUpdate);
	} else {
		d3.selectAll("#presets").style("display", "none");
		if (motif.name === "Custom") {
			d3.selectAll("#inferText").style("display", "none");
			d3.selectAll("#customPattern").style("display", "block");
		} else {
			d3.selectAll("#inferText").style("display", "block");
			d3.selectAll("#customPattern").style("display", "none");
		}
	}

	if (motif.name === "Custom") {
		if (tile.customTemplate && tile.customTemplate.length > 0) {
			// if the tile has a pre-existing custom template,
			// first update the multi-select, update all UI elements to reflect the parameters
			// and then draw the pattern
			patternMultiSelectUpdate(tile.customTemplate);
			updateUIForCustomTemplate(tile.customTemplate[0], true);
			patternUpdate();
		} else {
			// if there is no pre-existing custom template,
			// reset all UI elements to default values,
			// draw the default pattern and update the multi-select accordingly
			resetCustomPatternUIValues();
			patternUpdate();
			patternMultiSelectUpdate(tile.customTemplate);
		}
	} else {
		delete tile.customTemplate;
		patternUpdate();
	}

};

var patternMultiSelectUpdate = function(customTemplate) {

	// now that customTemplate is populated
	var sel = d3.select("#customPatternSelect").selectAll("option")
	.data(customTemplate);

	sel
	.enter()
	.append("option");

	sel
	.attr("value", function(d, i) { return i; })
	.html(function(d, i) { return "Pattern " + (i+1); });

	sel.exit().remove();

	sel.filter(function(d, i) { return i === 0;})
	.attr("selected", true);
};

var patternUpdate = function() {
	var index = patternDropdown.node().value;
	var motif = patternOptions[index];
	var tile = patternEditSVGDrawer.getTile();
	var patternFn;

	if (motif.name === "Custom") {
		patternFn = makePatterns(motif.generator(tile));
	} else {
		patternFn = makePatterns(motif.generator(tile, patternSlider1.getValue(), patternSlider2.getValue()));
	}
	polygonAddPattern(tile, patternFn);
	patternEditSVGDrawer.redrawPatterns();
};

var addToLineupClick = function() {
	pushPolygonToLineup(_.cloneDeep(shapeEditSVGDrawer.getTile()));
};

var addToLineupManualClick = function() {
	pushManualPolygonToLineup($("#sidelengths").val(), $("#interiorAngles").val());
};

var updateShapeClick = function() {
	var newTile = shapeEditSVGDrawer.getTile();
	var index = selection.index();
	shapeSVGDrawer.replace(newTile);
	shapeSVGDrawer.draw();
	selection.set(shapeSVGDrawer.container.selectAll("g.group")[0][index], {type: "group", updatePatternDisplay: false});
};


var updateTileWithPatternClick = function() {
	var motifIndex = patternDropdown.node().value;
	var motif = patternOptions[motifIndex];

	var newTile = patternEditSVGDrawer.getTile();
	polygonAddPatternMetadata(newTile);
	newTile.patternParams = {
		index: motifIndex,
		param1: patternSlider1.getValue(),
		param2: patternSlider2.getValue()
	};
	var index = selection.index();
	assembleSVGDrawer.replace(newTile);
	assembleSVGDrawer.draw();
	$("#patternModal").modal('hide');
	selection.set(assembleSVGDrawer.container.selectAll("g.group")[0][index], {type: "group", updatePatternDisplay: false});

	var tilesInCanvas = assembleCanvas.selectAll("g.tile").filter(function(d, i) { return d.polygonID === newTile.polygonID; });

	tilesInCanvas.each(function(d, i) {
		d3.select(this).selectAll("path.pattern").remove();
		d.customTemplate = _.cloneDeep(newTile.customTemplate);
		var patterns = motif.generator(d, patternSlider1.getValue(), patternSlider2.getValue());
		polygonAddPattern(d, makePatterns(patterns));
		d.patternParams = _.cloneDeep(newTile.patternParams);
		polygonAddPatternMetadata(d);
		drawPatterns(d3.select(this), {});
	});

	updateInferButton();
};

var newCustomPatternClick = function() {
	var newPattern = {
		startEdge: 0,
		patternDepth: 1,
		patternInterval: 2,
		startProportion: 0.5,
		endProportion: 0.5,
		isSymmetric: true,
		isCropped: true,
		symmetrySpec: "mirrorNoCrop",
		edgesSpec: "manual",
		applicableEdges: [[0,1]],
		points: _.map([[-20, 20]], function(t) {
			return {transform: num.translate(t)};
		})
	};

	var tile = patternEditSVGDrawer.getTile();
	tile.customTemplate.push(newPattern);
	patternUpdate();
	patternMultiSelectUpdate(tile.customTemplate);
};

var deleteCustomPatternClick = function() {
	var tile = patternEditSVGDrawer.getTile();
	tile.customTemplate = _.filter(tile.customTemplate, function(template, index) {
		return !_.find($("#customPatternSelect").val(), function(i) {
			return i === index+"";
		});
	});
	$("#customPatternSelect").val([]);
	patternUpdate();
	patternMultiSelectUpdate(tile.customTemplate);
}

var copyHandler = function(d, i) {
	if (selection.get().groupNode.parentNode === assembleCanvas.node()) {
		selection.copy();
	} else if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
		selection.copy(assembleSVGDrawer);
	}
};

var deleteHandler = function(d, i) {
	if (selection.get().groupNode.parentNode === assembleCanvas.node()) {
		// if there are no more inferTiles in the canvas, hide the infer button
		selection.delete();
		updateInferButton();
	} else if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
		selection.delete(assembleSVGDrawer);
	}
};

var updateInferButton = function() {
	var shouldDisplayButton = _.any(_.flatten(assembleCanvas.selectAll("g.tile")), function(n) {
		return n.__data__.infer;
	});
	inferButton.classed("hidden", !shouldDisplayButton);
};

var inferHandler = function(d, i) {
	var inferTiles = assembleCanvas.selectAll("g.tile").filter(function(d, i) { return d.infer; });
	if (_.flatten(inferTiles).length === 0) {
		alert("No tiles are on the inferred setting.");
	}
	inferTiles.each(function(d, i) {
		d3.select(this).selectAll("path.pattern").remove();

		var allRays = [];
		_.each(d.edges, function(edge, edgeIndex) {
			if (edge.joinedTo) {
				var otherEdge = edge.joinedTo.__data__;
				_.each(otherEdge.patterns, function(p) {
					allRays.push(rotatedRay(p.angle - Math.PI / 2, p.proportion)(edge, edgeIndex));
				});
			}
		});

		var greedy = greedyInference(allRays);

		var generator = _.map(greedy, function(pair) {
			return {
				start: {
					index: pair.rays[0].index,
					proportion: pair.rays[0].offset
				},
				end: {
					index: pair.rays[1].index,
					proportion: pair.rays[1].offset
				},
				template: pair.template,
				isSymmetric: false,
				isCropped: false,
				isAbsolute: true
			};
		});

		polygonAddPattern(d, makePatterns(generator));
		polygonAddPatternMetadata(d);
		drawPatterns(d3.select(this), {});
	});
};

var thicknessSliderChange = function() {
	d3.selectAll("path.strip").style("stroke-width", thicknessSlider.getValue());
	d3.selectAll("path.strip-outline").style("stroke-width", thicknessSlider.getValue() + 1);
};

var extensionSliderChange = function() {
	traceCanvas.selectAll("path").remove();
	resetAndDraw(traceCanvas, _.cloneDeep(polylist), tracePatternOptions);
	colorMap = _.map(stripColors, function(c) {
		return {
			color: c,
			strips: []
		};
	});
	d3.select("#noneSoFar").style("display", "block");
	d3.select("#stripTable").selectAll("div").remove();
	redrawCanvas();
};

// toggle visibility of edges and vertices
var shapeEditToggle = function() {
	var s =	d3.select(shapeEditSVGDrawer.getTile().this).selectAll(".label")
	.attr("visibility", shapeEditToggleButton.classed("active") ? "hidden" : "visible");
};

var tileViewClick = function() {
	assembleCanvas
	.each(function(d, i) {
		d.transform = traceCanvas.datum().transform;
	})
	.attr("transform", num.getTransform);

	stripView.classed("active", false);
	d3.select("#assembleTab").classed("active", true).classed("hidden", false);
	d3.select("#traceTab").classed("active", false).classed("hidden", true);
};

var cropPattern = function(tile, parentGroup) {
	var xOffset = num.dot(parentGroup.transform, tile.transform)[0][2];
	var yOffset = num.dot(parentGroup.transform, tile.transform)[1][2];

	var xThreshold = [0, 400];
	var yThreshold = [50, 400];

	var xRelativeThreshold = [xThreshold[0] - xOffset, xThreshold[1] - xOffset];
	var yRelativeThreshold = [yThreshold[0] - yOffset, yThreshold[1] - yOffset];

	var dim = tile.dimensions;

	var dummyEdges = [];

	var maxDimEstimate = numeric.norm2([dim.height, dim.width]) / 2;

	var rotation = num.inv(num.dot(num.getRotation(parentGroup.transform),num.getRotation(tile.transform)));

	if (- maxDimEstimate + yOffset < yThreshold[0]) {
		var ends = num.matrixToCoords(num.dot(rotation, num.coordsToMatrix(
			[[dim.left - 0.1, yRelativeThreshold[0]],[dim.right + 0.1, yRelativeThreshold[0]]])));
		dummyEdges.push({
			ends: ends,
			joinedTo: null,
			length: dim.width,
			patterns: [],
			index: tile.edges.length
		});
	}

	if (maxDimEstimate + yOffset > yThreshold[1]) {
		var ends = num.matrixToCoords(num.dot(rotation, num.coordsToMatrix(
			[[dim.left - 0.1, yRelativeThreshold[1]],[dim.right + 0.1, yRelativeThreshold[1]]])));
		dummyEdges.push({
			ends: ends,
			joinedTo: null,
			length: dim.width,
			patterns: [],
			index: tile.edges.length + 1
		});
	}

	if (- maxDimEstimate + xOffset < xThreshold[0]) {
		var ends = num.matrixToCoords(num.dot(rotation, num.coordsToMatrix(
			[[xRelativeThreshold[0], dim.top - 0.1],[xRelativeThreshold[0], dim.bottom + 0.1]])));
		dummyEdges.push({
			ends: ends,
			joinedTo: null,
			length: dim.width,
			patterns: [],
			index: tile.edges.length + 2
		});
	}

	if (maxDimEstimate + xOffset > xThreshold[1]) {
		var ends = num.matrixToCoords(num.dot(rotation, num.coordsToMatrix(
			[[xRelativeThreshold[1], dim.top - 0.1],[xRelativeThreshold[1], dim.bottom + 0.1]])));
		dummyEdges.push({
			ends: ends,
			joinedTo: null,
			length: dim.width,
			patterns: [],
			index: tile.edges.length + 3
		});
	}

	var transform = num.dot(parentGroup.transform, tile.transform);
	var inRegion = function(vertex) {
		var absoluteVertex = num.matrixToCoords(num.dot(transform, num.coordsToMatrix([vertex])));
		return xThreshold[0] <= absoluteVertex[0][0] && absoluteVertex[0][0] <= xThreshold[1]
			&& yThreshold[0] <= absoluteVertex[0][1] && absoluteVertex[0][1] <= yThreshold[1];
	};

	var findDummyIntersections = function(lineSegment) {
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

	var findBestIntersection = function(lineSegment) {
		var dummyIntersections = findDummyIntersections(lineSegment);

		var results = _.chain(dummyIntersections)
			.filter(function(obj) {
				return obj.intersection.status === "Intersection";
			}).sortBy(function(obj) {
				return obj.intersection.points[0].relative;
			}).value();
		return results[0];
	};

	_.each(tile.edges, function(edge) {
		edge.patternInterface = _.map(edge.patterns, function(p) {
			return {
				angle: p.angle,
				proportion: p.proportion
			};
		});
	});

	if (dummyEdges.length > 0) {
		// for each pattern, crop with thresholds as necessary
		tile.patterns = _.flatten(_.map(tile.patterns, function(p) {
			var curInRegion = inRegion(p.allVertices[0]);
			var patterns;
			if (curInRegion) {
				patterns = [{
					start: p.start,
					end: null,
					internalVertices: []
				}];
			} else {
				patterns = [];
			}

			for (var ctr = 1; ctr < p.allVertices.length; ctr ++) {
				var curSubpattern = _.last(patterns);

				var lineSegment = [{x:p.allVertices[ctr-1][0],y:p.allVertices[ctr-1][1]},
					{x:p.allVertices[ctr][0],y:p.allVertices[ctr][1]}];

				var result = findBestIntersection(lineSegment);
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
							console.log("APPROX ERROR 2");
							// approximation error, the last point seen was effectively equal to this one
							if (curSubpattern.internalVertices.length == 0) {
								// this pattern technically doesn't exist, delete it
								patterns.splice(patterns.length - 1);
							} else {
								// this pattern's last seen vertex is equivalent to this one
								// delete last seen vertex from internal vertices, set end
								curSubpattern.internalVertices.splice(curSubpattern.internalVertices.length - 1);
								curSubpattern.end = {
									proportion: cropPt.relative2,
									coords: cropPt.coords,
									edge: cropEdge,
									index: cropEdge.index
								};
							}
						} else if (approxEqPoints(cropPt.coords, nextPt)) {
							console.log("APPROX ERROR 4");
							if (isLastPt) {
								// prefer to end on p.end instead of cropped edge
								curSubpattern.end = p.end;
							} else {
								curSubpattern.end = {
									proportion: cropPt.relative2,
									coords: cropPt.coords,
									edge: cropEdge,
									index: cropEdge.index
								};
							}
						} else {
							curSubpattern.end = {
								proportion: cropPt.relative2,
								coords: cropPt.coords,
								edge: cropEdge,
								index: cropEdge.index
							};
						}

						curInRegion = false;
					}
				} else {
					if (inRegion(nextPt)) {
						console.assert(typeof result === "object", "If pattern is entering region, some intersection with a cropped edge must be found.");
						// start a new pattern at the border
						if (approxEqPoints(cropPt.coords, nextPt)) {
							console.log("APPROX ERROR1");

							// approximation error, the last point seen was effectively equal to this one
							if (isLastPt) {
								// this pattern technically doesn't exist, no need to add it to patterns
							} else {
								// since p.allVertices[ctr] is effectively the same as results[0]
								var start = {
									proportion: cropPt.relative2,
									coords: cropPt.coords,
									edge: cropEdge,
									index: cropEdge.index
								};

								patterns.push({
									start: start,
									end: null,
									internalVertices: []
								});
								// this pattern's last seen vertex is equivalent to this one
								// don't push this vertex onto internalVertices
							}

						} else if (approxEqPoints(cropPt.coords, prevPt)) {
							console.log("APPROX ERROR3");
							if (ctr === 0) {
								patterns.push({
									start: p.start,
									end: null,
									internalVertices: null
								});
							} else {
								var start = {
									proportion: cropPt.relative2,
									coords: cropPt.coords,
									edge: cropEdge,
									index: cropEdge.index
								};

								if (isLastPt) {
									patterns.push({
										start: start,
										end: p.end,
										internalVertices: []
									});
								} else {
									patterns.push({
										start: start,
										end: null,
										internalVertices: [nextPt]
									});
								}
							}

						} else {

							var start = {
								proportion: cropPt.relative2,
								coords: cropPt.coords,
								edge: cropEdge,
								index: cropEdge.index
							};

							if (isLastPt) {
								patterns.push({
									start: start,
									end: p.end,
									internalVertices: []
								});
							} else {
								patterns.push({
									start: start,
									end: null,
									internalVertices: [nextPt]
								});
							}
						}

						curInRegion = true;
					}
				}
			}

			_.each(patterns, function(p) {
				computePatternDataFromInternalVertices(p);
			});

			console.log(patterns);

			return patterns;
		}));

		_.each(tile.patterns, function(p, idx) {
			p.index = idx;
		});

		tile.edges.extend(dummyEdges);
		polygonAddPatternMetadata(tile);
		// rebuild pattern metadata

		console.log(tile.edges);
	}

};

var stripViewClick = function() {
	traceCanvas.selectAll("path").remove();
	var clone = _.cloneDeep(polylist, deepCustomizer(false));
	_.each(clone, function(group) {
		_.each(group.tiles, circularize);
		for (var i = 0; i<group.tiles.length; i++) {
			cropPattern(group.tiles[i], group);
		}
	});
	resetAndDraw(traceCanvas, clone, tracePatternOptions);
	traceCanvas
	.each(function(d, i) {
		d.transform = assembleCanvas.datum().transform;
	})
	.attr("transform", num.getTransform);
	colorMap = _.map(stripColors, function(c) {
		return {
			color: c,
			strips: []
		};
	});
	d3.select("#noneSoFar").style("display", "block");
	d3.select("#stripTable").selectAll("div").remove();

	tileView.classed("active", false);
	d3.select("#assembleTab").classed("active", false).classed("hidden", true);
	d3.select("#traceTab").classed("active", true).classed("hidden", false);

	redrawCanvas();

};

var isNode = function(o){
  return (
    typeof Node === "object" ? o instanceof Node :
    o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string"
  );
};

var reduceCircularity = function(tile) {

	var tileCopy = _.cloneDeep(tile);
	_.each(tileCopy.patterns, function(p, index) {
		p.end.edge = p.end.edge.index; // replace reference with id
		p.start.edge = p.start.edge.index;
	});

	_.each(tileCopy.edges, function(e) {
		_.each(e.patterns, function(p) {
			p.pattern = p.pattern.index;
		});
	});

	return tileCopy;
};

var circularize = function(tile) {

	_.each(tile.patterns, function(p, index) {
		p.end.edge = tile.edges[p.end.edge]; // dereference index
		p.start.edge = tile.edges[p.start.edge];
	});

	_.each(tile.edges, function(e) {
		_.each(e.patterns, function(p) {
			p.pattern = tile.patterns[p.pattern];
		});
	});

	return tile;
};


var loadFromString = function(str) {
	loaded = JSON.parse(str);
	if (loaded.version >= minSupportedVersion) {
		shapeDropdown.node().value = parseInt(loaded.shapeDropdown, 10);
		$("#shapeDropdown").trigger("change");

		var canvasTransform = loaded.canvasTransform;

		assembleCanvas.each(function(d) {
			d.transform = canvasTransform;
		})
		.attr("transform", num.getTransform);
		commonZoomHandler.scale(num.getScale(canvasTransform));
		commonZoomHandler.translate(num.getTranslation(canvasTransform));

		polylist = loaded.polylist;
		var palette = loaded.palette;

		_.each(polylist, function(group) {
			_.each(group.tiles, circularize);
		});

		_.each(palette, circularize);

		// draw anything in local storage
		resetAndDraw(assembleCanvas, polylist, assembleCanvasOptions);
		assembleSVGDrawer.set(palette);
		assembleSVGDrawer.draw();

		if (loaded.stripViewParams) {
			var p = loaded.stripViewParams;

			p.thickness ? thicknessSlider.setValue(p.thickness) : null;
			p.extension ? extensionSlider.setValue(p.extension) : null;
			p.stripHeight ? stripHeight.setValue(p.stripHeight) : null;
			p.widthFactor ? widthFactor.setValue(p.widthFactor) : null;
			p.interSpacing ? interSpacing.setValue(p.interSpacing) : null;
			p.printHeight ? printHeight.setValue(p.printHeight) : null;
			p.printWidth ? printWidth.setValue(p.printWidth) : null;
			if (typeof p.outline !== "undefined") {
				outlineToggle.classed("active", p.outline);
				outlineToggle.on("click")();
				outlineToggle.on("click")();
			}
		}

		updateInferButton();
	} else {
		if (typeof loaded.version === "undefined") {
			loaded.version = "?";
		}
		throw {
			message: "File was from Wallpaper v" + loaded.version +
				" but only >=v" + minSupportedVersion + " is supported."
		};
	}
};

var loadFromFile = function() {
	var reader = new FileReader();

	var files = $("#loadFileInput")[0].files;


	if (files.length === 1) {

		reader.onload = function() {
			try {
				loadFromString(reader.result);
			} catch (err) {
				bootbox.alert(err.message);
			}
		};

		reader.readAsText(files[0]);
	}
};

var saveToFileWithTitle = function(title) {

	var nonCircularPolylist = _.cloneDeep(polylist, deepCustomizer(true, true));

	var nonCircularPalette = _.map(assembleSVGDrawer.get(), function(tile) {
		return reduceCircularity(tile);
	});

	var saveFile = {
		polylist: nonCircularPolylist,
		palette: nonCircularPalette,
		canvasTransform: assembleCanvas.node().__data__.transform,
		shapeDropdown: shapeDropdown.node().value,
		version: wallpaperVersion,
		stripViewParams: {
			thickness: thicknessSlider.getValue(),
			extension: extensionSlider.getValue(),
			outline: outlineToggle.classed("active"),
			stripHeight: stripHeight.getValue(),
			widthFactor: widthFactor.getValue(),
			interSpacing: interSpacing.getValue(),
			printHeight: printHeight.getValue(),
			printWidth: printWidth.getValue()
		}
	};

	var saveFileText = JSON.stringify(saveFile, function(k,v) {
		return (isNode(v)) ? "tag" : v;
	});

	var bb = new Blob([saveFileText], {type: "application/json"});
	var pom = d3.select("#downloadLink").node();
	pom.download = title;
	pom.href = window.URL.createObjectURL(bb);
	pom.dataset.downloadurl = ["application/json", pom.download, pom.href].join(':');
	pom.click();
};

var saveToFile = function() {

	bootbox.prompt({
		title: "Save design as:",
		value: "newfile.wlpr",
		callback: function(result) {
			if (result !== null) {
				saveToFileWithTitle(result);
			}
		}
	});
};

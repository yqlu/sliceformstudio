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

var dragSvgHandler = d3.behavior.drag()
.on('dragstart', function(d, i) {
	document.body.style.cursor = 'row-resize';
})
.on("drag", function(d,i) {
	// update x y coordinates
	var newHeight = Math.min(Math.max(d3.event.y, 300),1200);
	d3.select("#traceSvg svg").attr("height", newHeight);
	d3.select("#assembleSvg svg").attr("height", newHeight);
	d3.select(this)
	.attr("y1", newHeight)
	.attr("y2", newHeight);
	assembleSvgDimensions
	.attr("y", newHeight - 20)
	.text(assembleSvg.node().offsetWidth + "px x " + newHeight + "px");
	traceSvgDimensions
	.attr("y", newHeight - 20)
	.text(traceSvg.node().offsetWidth + "px x " + newHeight + "px");
})
.on('dragend', function(d, i) {
	document.body.style.cursor = 'auto';
	assembleSvgDimensions.text("");
	traceSvgDimensions.text("");
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

			var templateClone = _.cloneDeep(template);

			$("#customPatternSelect").val(thisIndex);
			$(":radio[value=" + templateClone.edgesSpec + "]").prop("checked", true);
			$(":radio[value=" + templateClone.symmetrySpec + "]").prop("checked", true);
			$("#patternInterval").val(templateClone.patternInterval);
			$("#patternStart").val(templateClone.startEdge);
			$("#patternDepth").val(templateClone.patternDepth);
			$("#manualEdges").val(JSON.stringify(templateClone.applicableEdges));
			startOffset.setValue(templateClone.startProportion - 0.5);
			endOffset.setValue(templateClone.endProportion - 0.5);
			degreesOfFreedom.setValue(templateClone.points.length);

			tile.customTemplate[thisIndex] = templateClone;
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

	assemblePaletteButtons.each(function(d) {
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
			if (thisNode.parentNode.parentNode.parentNode !== assemblePaletteContainer.node()) {
				if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
					enterCanvas(selection.get().groupNode);
				}
				joinEdges(thisNode, selection.get());
			}
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
	console.log(this);
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

var mostRecentShapeDropdownIndex = -1;

var shapeDropdownChange = function() {
	if (mostRecentShapeDropdownIndex > -1) {
		var previousOption = shapeOptions[mostRecentShapeDropdownIndex];
		var currentPalette = assembleSVGDrawer.get();
		previousOption.polygons = function() {
			return currentPalette;
		};
	}

	var index = shapeDropdown.node().value;
	var currentOption = shapeOptions[index];
	assembleSVGDrawer.set(currentOption.polygons());
	assembleSVGDrawer.draw();

	selection.clear();
	mostRecentShapeDropdownIndex = index;
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
	$("#customShapeModal").modal('hide');
};

var addToLineupManualClick = function() {
	pushManualPolygonToLineup($("#sidelengths").val(), $("#interiorAngles").val());
	$("#customShapeModal").modal('hide');
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
};

var copyHandler = function(d, i) {
	if (selection.get()) {
		if (selection.get().groupNode.parentNode === assembleCanvas.node()) {
			selection.copy();
		} else if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
			selection.copy(assembleSVGDrawer);
		}
	}
};

var deleteHandler = function(d, i) {
	if (selection.get()) {
		if (selection.get().groupNode.parentNode === assembleCanvas.node()) {
			// if there are no more inferTiles in the canvas, hide the infer button
			selection.delete();
			updateInferButton();
		} else if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
			selection.delete(assembleSVGDrawer);
		}
	}
};

var clearHandler = function(d, i) {
	bootbox.confirm("Starting a new design will erase any unsaved progress you have. Are you sure?", function(result) {
		if (result) {
			polylist = [];
			assembleCanvas.selectAll("g").remove();
			inferButton.classed("hidden", true);
		}
	});
};

var editSpecificPattern = function(tiles) {
	return function() {
		selection.set(tiles[0].this.parentNode, {type: 'group'});
		$("#patternModal").modal();
		patternEditSVGDrawer.set(_.cloneDeep(tiles));
		patternEditSVGDrawer.draw();
		d3.select(patternEditSVGDrawer.container[0][0].parentNode.parentNode).select("rect").each(
			function(d) {
				d.zoomHandler.translate([0,0]);
				d.zoomHandler.scale(1);
		});
		d3.select(patternEditSVGDrawer.container[0][0].parentNode).each(function(d) {
			d.transform = _.cloneDeep(d.origTransform);
		}).attr("transform", num.getTransform);
		if (tiles[0].patternParams) {
			var params = tiles[0].patternParams;
			patternDropdown.node().value = params.index;
			$("#patternDropdown").trigger("change");
			patternSlider1.setValue(params.param1);
			patternSlider2.setValue(params.param2);
		} else {
			patternDropdown.node().value = 0;
			$("#patternDropdown").trigger("change");
		}
	};
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
		bootbox.alert("No tiles are on the inferred setting.");
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
	// should find way to optimize
	traceCanvas.selectAll("path").remove();
	var clone = _.cloneDeep(polylist, deepCustomizer(false));
	_.each(clone, function(group) {
		_.each(group.tiles, function(tile) {
			circularize(tile);
			generatePatternInterface(tile);
			if ($("#cropMode").prop("checked") && cropData.hull.length >= 3) {
				cropPattern(tile, group);
			}
		});
	});
	resetAndDraw(traceCanvas, clone, tracePatternOptions);

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

var cropModeToggle = function(e, state) {
	if (state) {
		assembleCropOverlay.attr("opacity", 0);
		assembleCropCanvasPathOverlay.style("display", "inline");
		assembleCropCanvas.selectAll(".crop-vertex").style("display", "inline");
	} else {
		assembleCropOverlay.attr("opacity", 0.5);
		assembleCropCanvasPathOverlay.style("display", "none");
		assembleCropCanvas.selectAll(".crop-vertex").style("display", "none");
	}
};

var cropSelectAll = function() {
	d3.selectAll(".crop-vertex").classed("selected", true);
	cropData.vertices = _.pluck(d3.selectAll(".crop-vertex")[0], "__data__");
	recomputeHull();
};

var cropUnselectAll = function() {
	d3.selectAll(".crop-vertex").classed("selected", false);
	cropData.vertices = [];
	recomputeHull();
};

var cropCircleClick = function(d) {
	if (d3.select(this).classed("selected")) {
		cropData.vertices = _.filter(cropData.vertices, function(v) {
			return (v !== d);
		});
		d3.select(this).classed("selected", false);
	} else {
		cropData.vertices.push(d);
		d3.select(this).classed("selected", true);
	}
	recomputeHull();
};

var cropDesignClick = function() {
	keyboardJS.setContext("cropView");

	assembleCanvas.classed("bg", true);

	assembleCropCanvas
	.each(function(d, i) {
		d.transform = assembleCanvas.datum().transform;
	})
	.attr("transform", num.getTransform);

	d3.select("#tileViewMenu").classed("hidden", true);
	d3.select("#cropViewMenu").classed("hidden", false);

	assemblePalette.each(function(d) {
		var width = d3.select(this).select(".palette-background").attr("width");
		d.transform = num.translate(- width / 2, 0);
	})
	.transition()
	.duration(1000)
	.attr("transform", num.getTransform);

	// assemblePalette.classed("hidden", true);
	setupOverlay();

	d3.select("#assembleSvgContainer").select(".shadedOverlay").style("visibility",
		(polylist.length === 0) ? "visible" : "hidden");
};

var exitCropView = function() {
	keyboardJS.setContext("tileView");
	d3.select("#tileViewMenu").classed("hidden", false);
	d3.select("#cropViewMenu").classed("hidden", true);

	assembleCanvas.classed("bg", false);
	assemblePalette.each(function(d) {
		var width = d3.select(this).select(".palette-background").attr("width");
		d.transform = num.translate(width / 2, 0);
	})
	.transition()
	.duration(1000)
	.attr("transform", num.getTransform);

	d3.select("#assembleSvgContainer").select(".shadedOverlay").style("visibility", "hidden");

	teardownOverlay();
};

var tileViewClick = function() {
	keyboardJS.setContext("tileView");

	if (!tileView.classed("active")) {
		assembleCanvas
		.each(function(d, i) {
			d.transform = traceCanvas.datum().transform;
		})
		.attr("transform", num.getTransform);
		d3.select("#tileViewMenu").classed("hidden", false);
		d3.select("#cropViewMenu").classed("hidden", true);

		assembleCanvas.classed("bg", false);

		tileView.classed("active", true);
		stripView.classed("active", false);

		d3.select("#assembleTab").classed("active", true).classed("hidden", false);
		d3.select("#traceTab").classed("active", false).classed("hidden", true);

		assemblePalette.classed("hidden", false);

		teardownOverlay();

	}
};

var stripViewClick = function() {
	keyboardJS.setContext("stripView");

	if (!stripView.classed("active")) {
		setupOverlay();

		traceCanvas.selectAll("path").remove();
		var clone = _.cloneDeep(polylist, deepCustomizer(false));
		_.each(clone, function(group) {
			_.each(group.tiles, function(tile) {
				circularize(tile);
				generatePatternInterface(tile);
				if ($("#cropMode").prop("checked") && cropData.hull.length >= 3) {
					cropPattern(tile, group);
				}
			});
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
		stripView.classed("active", true);

		d3.select("#assembleTab").classed("active", false).classed("hidden", true);
		d3.select("#traceTab").classed("active", true).classed("hidden", false);

		redrawCanvas();

		d3.select("#traceSvg").select(".shadedOverlay").style("visibility",
			(d3.select("#traceSvg").selectAll(".strip")[0].length === 0) ? "visible" : "hidden");
	}
};

var loadFromFile = function() {
	d3.select(".loading-overlay").classed("in", true);
	var reader = new FileReader();
	var files = $("#loadFileInput")[0].files;
	if (files.length === 1) {
		reader.onload = function() {
			try {
				var loaded = JSON.parse(reader.result);
				loadFromJson(loaded);
			} catch (err) {
				bootbox.alert(err.message);
			}
		};
		reader.readAsText(files[0]);
	}
	resetFormElement($("#loadFileInput"));
	d3.select(".loading-overlay").classed("in", false);
};


var resetFormElement = function(e) {
  e.wrap('<form>').closest('form').get(0).reset();
  e.unwrap();
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
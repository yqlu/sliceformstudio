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
	d.transform = num.matrixRound(d.transform);
	d3.select(this).attr("transform", num.getTransform);

	// restore ui
	d3.select(this).classed("translucent", false);
	d3.select(this).attr('pointer-events', '');

	var isClick = (new Date()).getTime() - d.startTime < config.clickThreshold;

	// enter canvas if hover group originates from palette
	if (!isClick && this.parentNode === assemblePaletteContainer.node()) {
		var absoluteCoords = num.getTranslation(num.dot(this.parentNode.parentNode.__data__.transform,
			num.dot(this.parentNode.__data__.transform, this.__data__.transform)));
		var paletteWidth = parseFloat(assemblePaletteBg.attr("width"));
		if (absoluteCoords[0] > paletteWidth) {
			enterCanvas(this);
		} else {
			deletePaletteTile(this);
		}
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
	var transformedEvent = num.matrixToCoords(num.dot(this.parentNode.__data__.transform,
			num.coordsToMatrix([[d3.event.x, d3.event.y]])))[0];
	var transformedVertex = num.matrixToCoords(
			num.dot(this.parentNode.__data__.transform,
				num.coordsToMatrix([[d.x, d.y]])))[0];

	var angle = num.getAngle(transformedEvent[0], transformedEvent[1]) -
		num.getAngle(transformedVertex[0], transformedVertex[1]);

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
	centerGroupCoords(this.parentNode.parentNode);

})
.on("dragend", function(d) {
	d3.select(this.parentNode.parentNode)
	.attr("transform", function(d) {
		d.transform = num.matrixRound(d.transform);
		return num.getTransform(d);
	});

	// keep relative transforms of the tiles within the group unchanged
	// before and after dragging action
	// important for strip caching
	this.parentNode.parentNode.undoCentering();
	delete this.parentNode.parentNode.undoCentering;

	d3.select("body").style("cursor", "auto");
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
	var newHeight = Math.ceil(Math.min(Math.max(d3.event.y, 300),1200));
	d3.select("#traceSvg svg").attr("height", newHeight);
	d3.select("#assembleSvg svg").attr("height", newHeight);
	d3.selectAll("#traceSvg svg > line").attr("y1", newHeight)
	.attr("y2", newHeight);
	d3.selectAll("#assembleSvg svg > line").attr("y1", newHeight)
	.attr("y2", newHeight);
	var existingWidth = (tileView.classed("active")) ? assembleSvg.node().parentNode.clientWidth : traceSvg.node().parentNode.clientWidth;
	assembleSvgDimensions
	.attr("y", newHeight - 20)
	.text(existingWidth + "px x " + newHeight + "px");
	traceSvgDimensions
	.attr("y", newHeight - 20)
	.text(existingWidth + "px x " + newHeight + "px");
	d3.select('#traceSvg foreignObject').attr("height", newHeight + "px");
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
		var thisIndex = _.findIndex(tile.customTemplate, function(t) { return t.this === template.this; });

		if (forceFlag ||
			($("#customPatternSelect").val() && $("#customPatternSelect").val().length === 1 &&
			$("#customPatternSelect").val()[0] !== ""+thisIndex)) {

			var templateClone = template;

			$("#customPatternSelect").val(thisIndex);
			$(":radio[value=" + templateClone.edgesSpec + "]").prop("checked", true);
			$(":radio[value=" + templateClone.symmetrySpec + "]").prop("checked", true);
			$("#patternInterval").val(templateClone.patternInterval);
			$("#patternStart").val(templateClone.startEdge);
			$("#patternDepth").val(templateClone.patternDepth);
			$("#manualEdges").val(JSON.stringify(templateClone.applicableEdges));
			startOffset.setValue(templateClone.startProportion - 0.5, false, false);
			endOffset.setValue(templateClone.endProportion - 0.5, false, false);
			degreesOfFreedom.setValue(templateClone.points.length, false, false);

			tile.customTemplate[thisIndex] = templateClone;
		}
		d3.select(template.this.parentNode).selectAll("g.patternHelper").classed("active", false);
		d3.select(template.this).classed("active", true);
	}
};

var updateUIForCustomTemplateWithDefault = function(i) {
	updateUIForCustomTemplate(
		patternEditSVGDrawer.getTile().customTemplate[$("#customPatternSelect").val()[0]],true);
};

var resetCustomPatternUIValues = function() {
	$("#customPatternSelect").val(0);
	$(":radio[value=auto]").prop("checked", true);
	$(":radio[value=mirrorCrop]").prop("checked", true);
	$("#patternInterval").val(1);
	$("#patternStart").val(0);
	$("#patternDepth").val(1);
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
		d.transform = num.matrixRound(num.translateBy(d.transform, d3.event.dx, d3.event.dy));
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
		d.transform = num.matrixRound(num.translateBy(num.scaleBy(num.id, d3.event.scale), d3.event.translate[0], d3.event.translate[1]));
	})
	.attr("transform", num.getTransform);
};

// zoom handler for palette, only enable y panning
var assembleZoomPalette = d3.behavior.zoom()
.on("zoom", function(d, i) {
	var ty = assembleZoomPalette.translate()[1];

	ty = Math.min(ty, 0);
	if (config.standardHeight < assemblePaletteContainer.node().getBBox().height + 2 * config.sidebarSpacing) {
		ty = Math.max(ty, config.standardHeight - assemblePaletteContainer.node().getBBox().height - 2 * config.sidebarSpacing);
	} else {
		ty = Math.max(ty, 0);
	}
	assembleZoomPalette.translate([0, ty]);

	assemblePaletteContainer.each(function(d) {
		d.transform = num.translateBy(d.scaledTransform, 0, assembleZoomPalette.translate()[1]);
	})
	.attr("transform", num.getTransform);

	assemblePaletteButtons.each(function(d) {
		d.transform = num.translateBy(d.scaledTransform, 0, assembleZoomPalette.translate()[1]);
	})
	.attr("transform", num.getTransform);
});

var traceZoomPalette = d3.behavior.zoom()
.on("zoom", function(d, i) {
	var ty = traceZoomPalette.translate()[1];

	ty = Math.min(ty, 0);
	if (config.standardHeight < tracePaletteContainer.node().getBBox().height + 2 * config.sidebarSpacing) {
		ty = Math.max(ty, config.standardHeight - tracePaletteContainer.node().getBBox().height - 2 * config.sidebarSpacing);
	} else {
		ty = Math.max(ty, 0);
	}
	traceZoomPalette.translate([0, ty]);
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
	selection.set(this, {type: "group"});
};

// mouseover handler for edge handle node
var handleMouseover = function(edgeNode) {
	if (hover && edgeNode !== hover.node && !d3.select(edgeNode).classed("joined")) {
		candidate = edgeNode;
	}
	d3.selectAll([edgeNode, edgeNode.__data__.joinedTo && edgeNode.__data__.joinedTo.node]).classed('hover', true);
};

// mouseout handler for edge handle node
var handleMouseout = function(edgeNode) {
	candidate = null;
	if (!hover || (edgeNode !== hover.node)) {
		d3.selectAll([edgeNode, edgeNode.__data__.joinedTo && edgeNode.__data__.joinedTo.node]).classed('hover', false);
	}
};

// clicking a pattern
var patternClick = function(thisNode) {
	assignStripColor(thisNode, $("#colorpicker").val());
	updateStripTable();
};

var shapeEditCustomDraw = function() {
	shapeEditSVGDrawer.set([regularPolygon(parseInt(sideNumberSlider.getValue(), 10), 1)]);
	shapeEditSVGDrawer.draw();
};

var patternDropdownChange = function() {

	if (patternSelectize.items.length !== 1) {
		return;
	}
	var index = patternSelectize.items[0];
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
		// reset the custom template UI to its default values
		updateUIForCustomTemplate(null, true);
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

	if (patternSelectize.items.length !== 1) {
		return;
	}
	var index = patternSelectize.items[0];
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

var patternPreview = function(motif, customTemplate) {
	var previousSelectedMotif = patternOptions[patternDropdown.node().value];
	var patternFn;
	var tile = patternEditSVGDrawer.getTile();
	var n = tile.vertices.length;

	if (motif.parameters.length === 2) {
		if (previousSelectedMotif.name === motif.name) {
			// use the slider values
			patternFn = makePatterns(motif.generator(tile,
				patternSlider1.getValue(), patternSlider2.getValue()));
		} else {
			// use the default values
			patternFn = makePatterns(motif.generator(tile,
				motif.parameters[0].options(n).value,
				motif.parameters[1].options(n).value));
		}
	} else {
		// reset customTemplate if present
		// custom preview takes values from existing DOM sliders
		tile.customTemplate = customTemplate;
		patternFn = makePatterns(motif.generator(tile));
	}
	polygonAddPattern(tile, patternFn);
	patternEditSVGDrawer.redrawPatterns();
};

var addToLineupClick = function() {
	pushPolygonToLineup(_.cloneDeep(shapeEditSVGDrawer.getTile()));
	$("#customShapeGUIModal").modal('hide');
};

var addToLineupManualClick = function() {
	pushManualPolygonToLineup($("#sidelengths").val(), $("#interiorAngles").val());
	$("#customShapeTextModal").modal('hide');
};

var updateTileWithPatternClick = function() {

	// deselect custom pattern multiselect to avoid changing existing patterns
	$("#customPatternSelect").val(null);

	var motifIndex = patternDropdown.node().value;
	var motif = patternOptions[motifIndex];

	var newTile = patternEditSVGDrawer.getTile();
	polygonAddPatternMetadata(newTile);
	newTile.patternParams = {
		index: motifIndex,
		param1: patternSlider1.getValue(),
		param2: patternSlider2.getValue()
	};
	assembleSVGDrawer.replace(newTile);
	assembleSVGDrawer.draw();
	$("#patternModal").modal('hide');

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
	invalidateStripCache();
};

var newCustomPatternClick = function() {
	var newPattern = {
		startEdge: 0,
		patternDepth: 1,
		patternInterval: 1,
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
	updateUIForCustomTemplate(tile.customTemplate[0], true);
	patternMultiSelectUpdate(tile.customTemplate);
};

var copyHandler = function(d, i) {
	if (selection.get()) {
		if (selection.get().groupNode.parentNode === assembleCanvas.node()) {
			selection.copy();
		} else if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
			selection.copy(assembleSVGDrawer);
		}
		invalidateStripCache();
	}
};

var deleteHandler = function(d, i) {
	if (selection.get()) {
		if (selection.get().groupNode.parentNode === assembleCanvas.node()) {
			// if there are no more inferTiles in the canvas, hide the infer button
			selection.delete();
			updateInferButton();
			invalidateStripCache();
		} else if (selection.get().groupNode.parentNode === assemblePaletteContainer.node()) {
			var id = d3.select(selection.get().groupNode).select("g.tile").node().__data__.tiles[0].polygonID;
			if (_.any(assembleCanvas.selectAll("g.tile")[0], function(t) {
				return t.__data__.polygonID === id;
			})) {
				bootbox.alert("You cannot delete a template tile in the palette if there are copies of it on the canvas.");
			} else {
				selection.delete(assembleSVGDrawer);
				invalidateStripCache();
			}
		}
	}
};

var clearHandler = function(d, i) {
	bootbox.confirm("All the tiles on the canvas will be deleted. Are you sure?", function(result) {
		if (result) {
			polylist = [];
			assembleCanvas.selectAll("g").remove();
			inferButton.classed("hidden", true);
			invalidateStripCache();
		}
	});
};

var editSpecificPattern = function(tiles) {
	var isRegular = isRegularPolygon(tiles[0].vertices);
	return function() {
		var patternSelectize = $("#patternDropdown")[0].selectize;

		var filteredPatterns = _.filter(patternOptions, function(opt) {
			if (!isRegular && opt.regularOnly) {
				return false;
			} else {
				return !(opt.betaFeature && opt.betaHidden);
			}
		});
		patternSelectize.clearOptions();
		patternSelectize.addOption(filteredPatterns);
		patternSelectize.refreshOptions(false);
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
			patternSelectize.setValue(params.index + "");
			$("#patternDropdown").trigger("change");
			patternSlider1.setValue(params.param1);
			patternSlider2.setValue(params.param2);
		} else {
			var defaultOption = isRegular ? "0" : "3";
			patternSelectize.setValue(defaultOption);
			$("#patternDropdown").trigger("change");
		}
		patternEditSVGDrawer.draw();

		var optionMouseenter = function(e){
			var motif = _.find(patternOptions, function(o) {
				return o.name === e.currentTarget.innerHTML;
			});
			patternPreview(motif, originalTile.customTemplate);
		};

		var originalTile;

		patternSelectize.on("dropdown_open", function() {
			$('body').on('mouseenter', '.selectize-dropdown-content .option', optionMouseenter);
			originalTile = _.cloneDeep(patternEditSVGDrawer.getTile());
		});
		patternSelectize.on("dropdown_close", function() {
			// unbind mouseenter event, reset original version of tile before pattern previews
			$('body').off('mouseenter', '.select2-results__option', optionMouseenter);
			tiles[0] = originalTile;
			patternUpdate();
		});
	};
};

var updateInferButton = function() {
	var shouldDisplayButton = _.any(_.flatten(assembleCanvas.selectAll("g.tile")), function(n) {
		return n.__data__.infer;
	});
	inferButton.classed("hidden", !shouldDisplayButton);
	// on load, if there are infer tiles on screen, turn the beta switch on
	if (shouldDisplayButton && !$("#patternInferSwitch").bootstrapSwitch('state')) {
		$("#patternInferSwitch").bootstrapSwitch("state", true);
	}
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
				var otherEdge = edge.joinedTo.node.__data__;
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

var originalZoomHandler = function(d, i) {
	commonZoomHandler.scale(1);
	var bbox = d3.select(this.parentNode.parentNode.parentNode).selectAll(".display.canvas")[0][0].getBBox();
	var svgWidth = (tileView.classed("active")) ? assembleSvg.node().parentNode.clientWidth : traceSvg.node().parentNode.clientWidth;
	var svgHeight = parseInt(assembleSvg.attr("height"),10);
	var paletteWidth = config.stripTableWidth;

	if (bbox.width > 0 && bbox.height > 0) {
		commonZoomHandler.translate([-bbox.x - bbox.width / 2 + paletteWidth + (svgWidth - paletteWidth) / 2,
			-bbox.y - bbox.height / 2 + svgHeight / 2]);
		d3.selectAll("#traceSvg, #assembleSvg").selectAll(".display.canvas").each(function(d) {
			d.transform = num.matrixRound(num.translateBy(num.scaleBy(num.id, commonZoomHandler.scale()),
				commonZoomHandler.translate()[0], commonZoomHandler.translate()[1]));
		}).attr("transform", num.getTransform);
	}
};

var zoomToFitHandler = function(d, i) {
	var canvasBbox = tileView.classed("active") ?
		computeVertexBbox(d3.select(".canvas").selectAll(".vertex"), false) :
		computeStripBbox(traceSvg.selectAll(".strip-below"));

	if (_.all(_.values(canvasBbox), isFinite)) {
		var svgWidth = (tileView.classed("active")) ? assembleSvg.node().parentNode.clientWidth : traceSvg.node().parentNode.clientWidth;
		var svgHeight = parseInt(assembleSvg.attr("height"),10);
		var paletteWidth = config.stripTableWidth;

		var scale = 1.05 * Math.max(canvasBbox.height / svgHeight, canvasBbox.width / (svgWidth - paletteWidth));

		commonZoomHandler.scale(1 / scale);

		var translate = [
			(- canvasBbox.x - canvasBbox.width / 2) / scale + paletteWidth + (svgWidth - paletteWidth) / 2,
			(- canvasBbox.y - canvasBbox.height / 2) / scale + svgHeight / 2];
		commonZoomHandler.translate(translate);

		d3.selectAll("#traceSvg, #assembleSvg").selectAll(".display.canvas").each(function(d) {
			d.transform = num.matrixRound(num.translateBy(num.scaleBy(num.id, commonZoomHandler.scale()),
				commonZoomHandler.translate()[0], commonZoomHandler.translate()[1]));
		}).attr("transform", num.getTransform);
	}
};

var thicknessSliderChange = function() {
	d3.selectAll("path.strip").style("stroke-width", thicknessSlider.getValue());
	d3.selectAll("path.strip-outline").style("stroke-width", thicknessSlider.getValue() + 1);
};

var extensionSliderChange = function() {
	d3.selectAll(".strip.strip-below").each(function(d) {
		d.updateExtension(extensionSlider.getValue());
	});
};

// toggle visibility of edges and vertices
var shapeEditToggle = function() {
	var s =	d3.select(shapeEditSVGDrawer.getTile().this).selectAll(".label")
	.attr("visibility", $("#shapeEditToggle").bootstrapSwitch("state") ? "visible" : "hidden");
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
	invalidateStripCache();
};

var cropUnselectAll = function() {
	d3.selectAll(".crop-vertex").classed("selected", false);
	cropData.vertices = [];
	recomputeHull();
	invalidateStripCache();
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
	invalidateStripCache();
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

	d3.selectAll("#assembleSvgToolbar").transition().duration(1000)
	.style("left", "5px");

	setupOverlay();

	d3.select("#assembleSvgContainer").select(".shadedOverlay").style("visibility",
		(polylist.length === 0) ? "visible" : "hidden");
};

var exitCropView = function() {
	keyboardJS.setContext("tileView");
	d3.select("#tileViewMenu").classed("hidden", false);
	d3.select("#cropViewMenu").classed("hidden", true);

	var paletteWidth = parseInt(assembleSvg.select(".palette-background").attr("width"),10);


	assembleCanvas.classed("bg", false);
	assemblePalette.each(function(d) {
		d.transform = num.translate(paletteWidth / 2, 0);
	})
	.transition()
	.duration(1000)
	.attr("transform", num.getTransform);

	d3.selectAll("#assembleSvgToolbar").transition().duration(1000)
	.style("left", (paletteWidth + 5) + "px");

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

		assembleCropCanvas
		.each(function(d, i) {
			d.transform = assembleCanvas.datum().transform;
		})
		.attr("transform", num.getTransform);

		tileView.classed("active", true);
		stripView.classed("active", false);

		d3.select("#assembleTab").classed("active", true).classed("hidden", false);
		d3.select("#traceTab").classed("active", false).classed("hidden", true);

		if (d3.select("#cropViewMenu").classed("hidden")) {
			teardownOverlay();
			assemblePalette.classed("hidden", false);

			assemblePalette.each(function(d) {
				var width = d3.select(this).select(".palette-background").attr("width");
				d.transform = num.translate(width / 2, 0);
			})
			.transition()
			.duration(1000)
			.attr("transform", num.getTransform);
		}

	}
};

var stripViewCached = false;

var invalidateStripCache = function() {
	stripViewCached = false;
};

var stripViewClick = function() {
	keyboardJS.setContext("stripView");

	if (!stripView.classed("active")) {
		try {
			if (stripViewCached) {
				traceCanvas.each(function(d, i) {
					d.transform = assembleCanvas.datum().transform;
				})
				.attr("transform", num.getTransform);

				traceCanvas.selectAll("g.group").each(function(d) {
					d.transform = d.assembleCounterpart.transform;
				})
				.attr("transform", num.getTransform);
			} else {
				setupOverlay();

				d3.selectAll("path.pattern")
				.each(function(d) {
					delete d.isStripAssigned;
					delete d.assignStripColor;
				});

				traceCanvas.selectAll("path").remove();
				var clone = _.cloneDeep(polylist, deepCustomizer(false));
				_.each(clone, function(group, groupIdx) {
					group.assembleCounterpart = polylist[groupIdx];
					_.each(group.tiles, function(tile, tileIdx) {
						circularize(tile);
						generatePatternInterface(tile);
						_.each(tile.patterns, function(pattern, patternIdx) {
							pattern.assembleCounterpart = polylist[groupIdx].tiles[tileIdx].patterns[patternIdx];
						});
						if ($("#cropMode").bootstrapSwitch("state") && cropData.hull.length >= 3) {
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

				oldColorMap = colorMap;

				colorMap = _.map(stripColors, function(c) {
					return {
						color: c,
						strips: []
					};
				});

				d3.select("#noneSoFar").style("display", "block");
				sidebarForm.selectAll("div").remove();

				redrawCanvas();

				_.each(oldColorMap, function(c) {
					_.each(c.strips, function(s) {
						_.each(s.patternList, function(p) {
							if (p.assembleCounterpart.isStripAssigned && !p.assembleCounterpart.isStripAssigned()) {
								p.assembleCounterpart.assignStripColor(c.color.hex);
							}
						});
					});
				});

				var noStripsOnCanvas = d3.select("#traceSvg").selectAll(".strip")[0].length === 0;
				d3.select("#traceSvg").select(".shadedOverlay").style("visibility",
					(noStripsOnCanvas ? "visible" : "hidden"));
				d3.select("#traceSvg").select(".palette").style("visibility",
					(noStripsOnCanvas ? "hidden" : "visible"));
				traceSvg.selectAll(".svg-toolbar").style("left", noStripsOnCanvas ? "0px" : config.stripTableWidth + "px");
			}
			tileView.classed("active", false);
			stripView.classed("active", true);

			d3.select("#assembleTab").classed("active", false).classed("hidden", true);
			d3.select("#traceTab").classed("active", true).classed("hidden", false);

			stripViewCached = true;
		} catch(e) {
			console.log(e);
			// undo UI changes gracefully if error is found
			tileViewClick();
			teardownOverlay();
		}
	}
};

var loadFromFile = function() {
	d3.select(".loading-overlay").classed("in", true);
	var reader = new FileReader();
	var files = $("#loadFileInput")[0].files;
	if (files.length === 1) {
		var loadedFilename = files[0].name;
		reader.onload = function() {
			try {
				var loaded = JSON.parse(reader.result);
				loadFromJson(loaded, function() {
					currentFilename = loadedFilename.slice(0, loadedFilename.search(/\.slfm/));
				});
			} catch (err) {
				bootbox.alert(err.message);
				console.error(err);
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
		value: currentFilename + ".slfm",
		callback: function(result) {
			if (result !== null) {
				saveToFileWithTitle(result);
			}
		}
	});
};

var exportSvgHandler = function() {
	bootbox.prompt({
		title: "Export SVG as:",
		value: currentFilename + ".svg",
		callback: function(result) {
			if (result !== null) {
				var tmpSvg = exportImageInTmpSvg();
				svgAsDataUri(tmpSvg, {}, function(uri) {
					var pom = d3.select("#downloadLink").node();
					pom.download = result;
					pom.href = uri;
					pom.click();
					d3.select(tmpSvg).remove();
				});
			}
		}
	});
};

var exportPngHandler = function(d) {
	bootbox.prompt({
		title: "Export PNG as:",
		value: currentFilename + ".png",
		callback: function(result) {
			if (result !== null) {
				var tmpSvg = exportImageInTmpSvg();
				saveSvgAsPng(tmpSvg, result, {scale: d.factor});
				d3.select(tmpSvg).remove();
			}
		}
	});
};

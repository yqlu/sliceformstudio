var wallpaperVersion = 0.3;
var minSupportedVersion = 0.2;

// global UI variables
var hover = null;
var candidate = null;
var polylist = [];

// options for each different drawer

var assemblePaletteOptions = {
	orientation: "vertical",
	visibleVertices: true,
	vertexRotate: true,
	visibleEdges: true,
	clickableEdges: true,
	displayInterior: true,
	groupDraggable: true,
	autoresizeSidebar: true
};

var assembleCanvasOptions = {
	orientation: "vertical",
	visibleVertices: true,
	vertexRotate: true,
	visibleEdges: true,
	clickableEdges: true,
	displayInterior: true,
	groupDraggable: true,
	croppingOverlay: true
};

var tracePatternOptions = {
	orientation: "neutral",
	patternsTraceable: true,
};

var shapeEditPaletteOptions = {
	orientation: "neutral",
	visibleVertices: true,
	vertexEdit: true,
	visibleEdges: true,
	displayInterior: true
};

var patternEditPaletteOptions = {
	orientation: "neutral",
	visibleVertices: true,
	visibleEdges: true,
	displayInterior: true,
	draggablePatterns: true
};

// create the different SVG displays

var shapeEditSVGDrawer = buildPane("#shapeEditSvg", shapeEditPaletteOptions);

var patternEditSVGDrawer = buildPane("#patternEditSvg", patternEditPaletteOptions);

var commonZoomHandler = d3.behavior.zoom().on("zoom", zoomBehavior);

var assembleSvg = buildSvg("#assembleSvg", config.standardWidth, config.standardHeight);

var assembleBg = buildBg(assembleSvg, true, true, commonZoomHandler);
var assembleCanvas = buildDisplay(assembleSvg, num.id, true);
var assembleCropOverlay = buildOverlay(assembleSvg, commonZoomHandler);
var assembleCropCanvas = buildDisplay(assembleSvg, num.id, true);

var assembleCropCanvasPathOverlay = assembleCropCanvas.selectAll(".cropOverlayPath")
	.data([{id: 5}])
	.enter()
	.append("path")
	.classed("cropOverlayPath", true);

var assemblePalette = buildDisplay(assembleSvg, num.translate(config.initSidebarWidth / 2, 0));
var assemblePaletteBg = assemblePalette.append("rect")
	.classed("palette-background", true)
	.attr("width", config.initSidebarWidth)
	.attr("height", "100%")
	.attr("x", - config.initSidebarWidth / 2)
	.attr("y", 0)
	.style("cursor", "move")
	.call(assembleZoomPalette);

var assemblePaletteContainer = assemblePalette.append("g")
	.classed("palette-container", true)
	.datum(function() {
		return {
			this: this,
			origTransform: num.id,
			transform: num.id,
			previousScale: 1
		};
	});

var assemblePaletteButtons = assemblePalette.append("g")
	.classed("btn-container", true);

var assembleSVGDrawer = svgDrawer(assemblePaletteContainer, assemblePaletteOptions);
var assembleDraggableEdge = drawSvgDraggableEdge(assembleSvg);
var assembleSvgDimensions = drawSvgDimensionLabel(assembleSvg);

var traceSvg = buildSvg("#traceSvg", config.standardWidth, config.standardHeight);
var traceBg = buildBg(traceSvg, true, true, commonZoomHandler);
var traceCanvas = buildDisplay(traceSvg, assembleCanvas.datum().transform, true); // ensure they zoom the same amount
var traceDraggableEdge = drawSvgDraggableEdge(traceSvg);
var traceSvgDimensions = drawSvgDimensionLabel(traceSvg);

var tracePalette = buildDisplay(traceSvg, num.id).classed("palette", true);
var tracePaletteBg = tracePalette.append("rect")
	.classed("palette-background", true)
	.attr("width", config.stripTableWidth)
	.attr("height", "100%")
	.attr("x", 0)
	.attr("y", 0)
	.style("cursor", "move");

var tracePaletteContainer = tracePalette.append("g")
	.classed("palette-container", true);

var fo = tracePaletteContainer.append("foreignObject")
	.attr("height", config.standardHeight)
	.attr("width", config.stripTableWidth)
	.append("xhtml:body").classed("strip-table", true)
	.attr("xmlns", "http://www.w3.org/1999/xhtml")
	.append("div").classed("stripTablePadded", true);

fo.append("h4")
	.text("Strip generation");

var sidebarForm = fo
	.append("form").classed("form-horizontal", true);

var noneSoFar = fo
	.append("span")
	.attr("id", "noneSoFar")
	.text("You haven't assigned colors to any strips yet!");

// set listeners on tile / strip view toggles
var tileView = d3.select("#tileView")
.on("click", tileViewClick);

var stripView = d3.select("#stripView")
.on("click", stripViewClick);

// set listeners on tile view UI elements

var newButton = d3.select("#newDesign")
.on("click", function() {
	$("#newModal").modal('show');
});

var saveButton = d3.select("#saveFile")
.on("click", saveToFile);

var loadButton = d3.select("#loadFile");

$("#loadFileInput")
.on("change", loadFromFile);

var inferButton = d3.select("#infer")
	.on("click", inferHandler)
	.classed("hidden", true);

var clearButton = d3.select("#clear")
	.on("click", clearHandler);

var addShapeGUIButton = d3.select("#addShapeGUI")
	.on("click", function() {
		$("#customShapeGUIModal").modal();
	});

var addShapeTextButton = d3.select("#addShapeText")
	.on("click", function() {
		$("#customShapeTextModal").modal();
	});


var deleteButton = d3.select("#delete")
	.on("click", deleteHandler);

var copyButton = d3.select("#copy")
	.on("click", copyHandler);

d3.select("#selectAll").on("click", cropSelectAll);
d3.select("#unselectAll").on("click", cropUnselectAll);
d3.select("#exitCropView").on("click", exitCropView);

var cropDesign = d3.select("#cropDesign")
	.on("click", cropDesignClick);

var tileOptions = {
	basicTiles: [{
		name: "Hexagons",
		file: "hexagons"
	}, {
		name: "Squares",
		file: "squares"
	}, {
		name: "Hexagons, squares and triangles",
		file: "6434"
	}, {
		name: "Octagons and squares",
		file: "848"
	}, {
		name: "12-gons and triangles",
		file: "31212"
	}, {
		name: "12-gons, hexagons and squares",
		file: "4612"
	}],
	fillerTiles: [{
		name: "10-gons and fillers",
		file: "10filler"
	}, {
		name: "12-gons and fillers",
		file: "12filler"
	}, {
		name: "Octagons, 12-gons and fillers",
		file: "812filler"
	}, {
		name: "Nonagons, 12-gons and fillers",
		file: "912filler"
	}, {
		name: "Octagons, 16-gons and fillers",
		file: "816filler"
	}, {
		name: "18-gons and fillers",
		file: "18filler"
	}],
	almostRegular: [{
		name: "Pentagons and heptagons",
		file: "57"
	}, {
		name: "Altair tiling",
		file: "altair"
	}],
	quasiperiodic: [{
		name: "Pentagons and rhombi",
		file: "pentagonrhomb"
	}, {
		name: "Penrose rhombi",
		file: "penroserhomb"
	}, {
		name: "Penrose kites and darts",
		file: "kitesdarts"
	}, {
		name: "Heptagonal rhombi",
		file: "heptagonal"
	}, {
		name: "Girih tiles",
		file: "girih"
	}]
};

var generateHtml = function(container) {
	return function(opt) {
		var col = d3.select(container).append("div")
			.classed("col-lg-4 padded-col", true);
		col.append("div").classed("image-frame", true)
			.append("img")
			.attr("src", "images/starter/" + opt.file + ".png");
		col.append("a").classed("image-frame overlap-full", true)
			.attr("href", "#")
			.on("click", function() {
				$("#newModal").modal("hide");
				$.getJSON("/images/starter/" + opt.file + ".wlpr")
				.done(loadFromJson)
				.error(function() {
					bootbox.alert("Error: " + params.template + " is not a valid template.");
					d3.select(".loading-overlay").classed("in", false);
				});
			})
			.append("div").classed("gradient-overlay", true)
			.append("div").classed("gradient-title", true)
			.text(opt.name);
	};
};

$("#customTile").click(function() {
	$("#newModal").modal("hide");
	assembleSVGDrawer.set([]);
	assembleSVGDrawer.draw();
});

assembleSVGDrawer.set([]);
assembleSVGDrawer.draw();

_.each(tileOptions, function(opts, name) {
	_.each(opts, generateHtml("#" + name));
});

var patternDropdown = d3.select("#patternDropdown");

patternDropdown.selectAll("option").data(patternOptions).enter()
	.append("option")
	.attr("value", function(d, i) {return i;})
	.html(function(d) {return d.name;});

// set listeners on custom shape UI elements

$("#shapeEditToggle").bootstrapSwitch()
.on('switchChange.bootstrapSwitch', shapeEditToggle);

var addToLineupButton = d3.select("#addToLineup")
	.on("click", addToLineupClick);

var addToLineupManualButton = d3.select("#addToLineupManual")
	.on("click", addToLineupManualClick);

var sideNumberSlider = new Slider("#sideNumber", {
	min: 3,
	max: 18,
	step: 1,
	value: 9,
	formatter: function(value) {
		return 'Current value: ' + value;
	}
}).on("change", shapeEditCustomDraw);

var sideLengthSlider = new Slider('#sideLength', {
	min: 0.5,
	max: 4,
	step: 0.05,
	value: 1,
	formatter: function(value) {
		return 'Current value: ' + value;
	}
}).on("change", shapeEditCustomDraw);

shapeEditCustomDraw();

keyboardJS.setContext("tileView");

var kbdWrapper = function(f) {
	return function(e) {
		if ($(document.activeElement)[0].tagName !== "INPUT") {
			f();
			e.preventDefault();
		}
	};
};

keyboardJS.bind(['d'], kbdWrapper(copyHandler));
keyboardJS.bind(['backspace'], kbdWrapper(deleteHandler));
keyboardJS.bind(['n'], kbdWrapper(clearHandler));
keyboardJS.bind(['s'], kbdWrapper(saveToFile));
keyboardJS.bind(['+'], kbdWrapper(function() {
	$("#customShapeModal").modal();
}));

// no keyboard shortcut for loading file

// set listeners on edit pattern UI elements

$("#customPatternSelect").change(function(i) {
	updateUIForCustomTemplate(
		patternEditSVGDrawer.getTile().customTemplate[$("#customPatternSelect").val()[0]],true);
});

var confirmPatternButton = d3.select("#confirmPattern")
	.on("click", updateTileWithPatternClick);

var newCustomPatternButton = d3.select("#newCustomPattern")
	.on("click", newCustomPatternClick);

var deleteCustomPatternButton = d3.select("#deleteCustomPattern")
	.on("click", deleteCustomPatternClick);

var startOffset = new Slider('#startOffset', {
	value: 0,
	min: -0.5,
	max: 0.5,
	step: 0.01,
	formatter: function(value) {
		return 'Current value: ' + value;
	}
})
.on("change", patternUpdate);

var endOffset = new Slider('#endOffset', {
	value: 0,
	min: -0.5,
	max: 0.5,
	step: 0.01,
	formatter: function(value) {
		return 'Current value: ' + value;
	}
})
.on("change", patternUpdate);

$('form input[name=symmetryRadios][type=radio]:checked')
.change(patternUpdate);

$('form input[name=edgeRadios][type=radio]:checked')
.change(patternUpdate);

var degreesOfFreedom = new Slider('#degreesOfFreedom', {
	value: 1,
	min: 0,
	max: 6,
	step: 1,
	formatter: function(value) {
		return 'Current value: ' + value;
	}
}).on("change", patternUpdate);

var patternSlider1 = new Slider("#patternSlider1", {
	value: 0,
	min: 0,
	max: 1,
	step: 0.01
});

var patternSlider2 = new Slider("#patternSlider2", {
	value: 0,
	min: 0,
	max: 1,
	step: 0.01
});

// set listener on strip view UI elements

var stripColors = [
	{hex: "#F44336", name: "Red" },
	{hex: "#E91E63", name: "Pink"},
	{hex: "#9c26b0", name: "Purple"},
	{hex: "#673AB7", name: "Deep Purple"},
	{hex: "#3F51B5", name: "Indigo"},
	{hex: "#2196F3", name: "Blue"},
	{hex: "#03A9F4", name: "Light Blue"},
	{hex: "#00BCD4", name: "Cyan"},
	{hex: "#009688", name: "Teal"},
	{hex: "#4CAF50", name: "Green"},
	{hex: "#8BC34A", name: "Light Green"},
	{hex: "#CDDC39", name: "Lime"},
	{hex: "#FFEB3B", name: "Yellow"},
	{hex: "#FFC107", name: "Amber"},
	{hex: "#FF9800", name: "Orange"},
	{hex: "#FF5722", name: "Deep Orange"},
	{hex: "#795548", name: "Brown"},
	{hex: "#9E9E9E", name: "Grey"},
	{hex: "#607D8B", name: "Blue Grey"}
];

var colorMap = _.map(stripColors, function(c) {
	return {
		color: c,
		strips: []
	};
});

d3.select("#colorpicker").selectAll("option")
.data(stripColors)
.enter()
.append("option")
.attr("value", function(d) { return d.hex; })
.html(function(d) { return d.name; });

var exportSvg = d3.select("#exportSvg")
.on("click", function() {
	var svg = d3.select("#traceSvg").select("svg").node();
	svgAsDataUri(svg, {}, function(uri) {
		var pom = d3.select("#downloadLink").node();
		pom.download = "design.svg";
		pom.href = uri;
		pom.click();
	});
});

var exportPng = d3.select("#exportPng")
.on("click", function() {
	var svg = d3.select("#traceSvg").select("svg").node();
	saveSvgAsPng(svg, "design.png");
});

// generate dyanmic stylesheet for coloring
var newStylesheet = function() {
	// Create the <style> tag
	var style = document.createElement("style");

	// WebKit hack :(
	style.appendChild(document.createTextNode(""));

	// Add the <style> element to the page
	document.head.appendChild(style);

	return style.sheet;
};

var stylesheet = newStylesheet();

// initialize advanced SVG generation options UI elements

var advancedOptions = d3.select("#advancedOptions")
.on("click", function() {
	$('#advancedModal').modal();
	// recompute widthFactor
	widthFactor.setValue(widthFactor.getValue());
});

var stripHeight = new Slider("#stripHeight", {
	min: 10,
	max: 50,
	step: 1,
	value: 15,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
});

var widthFactor = new Slider("#widthFactor", {
	min: 0.1,
	max: 5,
	step: 0.1,
	value: 1.2,
	formatter: function(value) {
		var totalWidthPx;

		// getBBox might fail if the node is not yet rendered
		try {
			var maxDims = _.map(traceCanvas.selectAll("g.group")[0], function(g) {
				var bbox = g.getBBox();
				return Math.max(bbox.width, bbox.height);
			});
			totalWidthPx = Math.roundToPrecision(_.max(maxDims) * value, 1);
		} catch (e) {
			totalWidthPx = 0;
		}
		var totalWidthMm = Math.roundToPrecision(totalWidthPx / config.pixelToMm, 1);

		var longestPx = Math.roundToPrecision(longestStrip * value, 1);
		var longestMm = Math.roundToPrecision(longestPx / config.pixelToMm, 1);
		var shortestPx = Math.roundToPrecision(shortestSegment * value, 1);
		var shortestMm = Math.roundToPrecision(shortestPx / config.pixelToMm, 1);

		return 'Total width: ' + totalWidthPx + ' px = ' + totalWidthMm + ' mm\n' +
			'Longest strip: ' + longestPx + ' px = ' + longestMm + ' mm\n' +
			'Shortest segment: ' + shortestPx + ' px = ' + shortestMm + ' mm';
	}
});

var interSpacing = new Slider("#interSpacing", {
	min: 0,
	max: 50,
	step: 1,
	value: 15,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
});

var printHeight = new Slider("#printHeight", {
	min: 0,
	max: 3000,
	step: 10,
	value: 1620,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
});

var printWidth = new Slider("#printWidth", {
	min: 0,
	max: 3000,
	step: 10,
	value: 2880,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
});

var thicknessSlider = new Slider("#thickness", {
	min: 0,
	max: 10,
	step: 0.1,
	value: 5,
	formatter: function(value) {
		return value + ' px';
	}
}).on("change", thicknessSliderChange);

var extensionSlider = new Slider("#extensionLength", {
	min: 0,
	max: 2,
	step: 0.01,
	value: 0.15,
	formatter: function(value) {
		var pixels = value * widthFactor.getValue();
		var mm = Math.round(pixels / config.pixelToMm * 10) / 10;
		return mm + ' mm';
	}
}).on("change", extensionSliderChange);

$("#outlineToggle").bootstrapSwitch()
.on('switchChange.bootstrapSwitch', function() {
	d3.selectAll("path.strip-outline")
	.attr("visibility", $("#outlineToggle").prop("checked") ? "visible" : "hidden");
});

$(".collapse").collapse({toggle: true});

d3.select("#generateCustomStripBtn")
  .on("click", generateCustomStrip);

bootbox.setDefaults({
	container: "body#body"
});

// wrap jQuery plugins in document.ready
$(document).ready(function() {
	$("#colorpicker").simplecolorpicker({theme: 'regularfont'})
	.on("change", function() {
		stylesheet.deleteRule(0);
		stylesheet.insertRule("path.strip.hover { stroke: " + $("#colorpicker").val() + " !important }", 0);
	});

    var openTime = new Date().getTime();

	$("#patternDropdown").select2({
		minimumResultsForSearch: Infinity
	})
	.on("change", patternDropdownChange)
	// hack to prevent weird auto-behavior of select2
	.on("select2:open", function() {
		openTime = new Date().getTime();
	}).on("select2:closing", function(e) {
		var tempCounter = new Date().getTime();
		if (openTime > tempCounter - 1000) {
			e.preventDefault();
			return;
		}
	}).on("select2:selecting", function(e) {
		var tempCounter = new Date().getTime();
		if (openTime > tempCounter - 1000) {
			e.preventDefault();
			return;
		}
	});

	$("#autoSnap").bootstrapSwitch({
		onInit: function() {
			var label = d3.select(this.parentNode).select(".bootstrap-switch-label");
			label.html(label.text() + " <a href='#' id='autoSnapHint'><i class='fa fa-question-circle'></a>");
			d3.select("#autoSnapHint").on("click", function() {
				bootbox.alert({
					title: "Self joins",
					message: "<p>Under normal circumstances, Sliceform Studio will forbid you from joining two edges belonging to the same tile or to tiles in the same group. You can disable this check by turning off 'Snap Edges' in the toolbar. Now when you click on two edges in succession, the two tiles will no longer snap together, but the edges will still turn green to indicate that they are now joined.</p> <p>This is useful for creating non-planar configurations like cylinders, polyhedra and other configurations where edges are identified in topologically interesting ways. Refer to Rampart or Planetarium in the <a href='/gallery'>gallery</a> as examples of this.</p>"
				});
			});
		}
	});

	$("#cropMode").bootstrapSwitch().on('switchChange.bootstrapSwitch', cropModeToggle);

	stylesheet.insertRule("path.strip.hover { stroke: " + $("#colorpicker").val() + " !important }", 0);

	var params = getUrlVars();

	if (params.template) {
		if (params.template.search(/^\w+$/) >= 0) {
			d3.select(".loading-overlay").classed("in", true);
			$.getJSON("/images/gallery/wlpr_files/" + params.template + ".wlpr")
			.done(loadFromJson)
			.error(function() {
				bootbox.alert("Error: " + params.template + " is not a valid template.");
				d3.select(".loading-overlay").classed("in", false);
			});
		} else {
			bootbox.alert("Error: " + params.template + " is not a valid template.");
		}
	} else {
		$("#newModal").modal("show")
		.on("show.bs.modal", function() {
			$("#newModal .modal-body").scrollTop(0);
		})
		.on("shown.bs.modal", function() {
			$("#newModal .modal-body").scrollTop(0);
		});
	}

});
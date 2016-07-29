var wallpaperVersion = 0.3;
var minSupportedVersion = 0.2;

// global UI variables
var hover = null;
var candidate = null;
var polylist = [];

if (!document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Extensibility','1.1')) {
	// does not support ForeignObject
	bootbox.alert({
		title: "Browser not supported",
		message: "Error: your browser is not supported. Please use Firefox >=47, Chrome >=51, Safari >=9.0 or Edge >=13 instead for Sliceform Studio to work correctly."
	});
} else {

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
	visibleEdges: true,
	displayInterior: true
	// paneZoomable: true
};

var patternEditPaletteOptions = {
	orientation: "neutral",
	visibleVertices: true,
	visibleEdges: true,
	displayInterior: true,
	draggablePatterns: true
	// paneZoomable: true
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

var assembleOptimizeOverlay = buildOverlay(assembleSvg, commonZoomHandler);
var assembleOptimizeCanvas = buildDisplay(assembleSvg, num.id, true);

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

var optimizeTableFo = assemblePalette.append("foreignObject")
	.style("display", "none")
	.attr("height", config.standardHeight)
	.attr("width", config.stripTableWidth)
	.attr("x", -config.stripTableWidth / 2)
	.attr("y", 0);

var optimizeTable = optimizeTableFo
	.append("xhtml:body").classed("strip-table", true)
	.attr("xmlns", "http://www.w3.org/1999/xhtml")
	.append("div").classed("paletteTablePadded", true);

optimizeTable.append("h4").text("Your constraints");
var totalObjectiveLabel = optimizeTable.append("small").text("");

var optimizeBtnDiv = optimizeTable.append("div")
	.style("text-align", "center")
	.style("margin-top", "20px")
	.style("margin-bottom", "10px")
	.style("display", "none");

var optimizeBtn = optimizeBtnDiv
	.append("a").attr("id", "optimizeBtn")
	.classed("btn btn-primary", true)
	.style("margin-right", "10px")
	.text("Optimize!")
	.on("click", function() {
		createObjectives(optimizationConstraints).optimize()
		.then(function(val) {
			console.log(val);
		});
	});

var deleteAllConstraintsBtn = optimizeBtnDiv
	.append("a").attr("id", "resetAllConstraints")
	.classed("btn btn-default", true)
	.text("Reset all")
	.on("click", deleteAllConstraints);

var sidebarConstraintForm = optimizeTable
	.append("form").classed("form-horizontal", true);

var noConstraintsSoFar = optimizeTable
	.append("div")
	.attr("id", "noConstraintsSoFar")
	.html("Any constraints you add will show up here!");

var parallelConstraint = d3.select("#parallelConstraint")
	.on("click", constraintHandler(enforceParallel));
var perpendicularConstraint = d3.select("#perpendicularConstraint")
	.on("click", constraintHandler(enforcePerpendicular));
var collinearConstraint = d3.select("#collinearConstraint")
	.on("click", constraintHandler(enforceCollinear));
var equalLengthConstraint = d3.select("#equalLengthConstraint")
	.on("click", constraintHandler(enforceEqualLength));
var bisectConstraint = d3.select("#bisectConstraint")
	.on("click", constraintHandler(enforceBisection));
var constantGradientConstraint = d3.select("#constantGradientConstraint")
	.on("click", constraintHandler(enforceConstantGradient));
var constantLengthConstraint = d3.select("#constantLengthConstraint")
	.on("click", constraintHandler(enforceConstantLength));
var constantAngleConstraint = d3.select("#constantAngleConstraint")
	.on("click", constraintHandler(enforceConstantAngle));
var specificAngleConstraint = d3.select("#specificAngleConstraint")
	.on("click", constraintHandler(enforceSpecificAngle));
var specificGradientConstraint = d3.select("#specificGradientConstraint")
	.on("click", constraintHandler(enforceSpecificGradient));
var specificLengthConstraint = d3.select("#specificLengthConstraint")
	.on("click", constraintHandler(enforceSpecificLength));
var lengthRatioConstraint = d3.select("#lengthRatioConstraint")
	.on("click", constraintHandler(enforceLengthRatio));
var lengthDiffConstraint = d3.select("#lengthDiffConstraint")
	.on("click", constraintHandler(enforceLengthDifference));

var assembleSVGDrawer = svgDrawer(assemblePaletteContainer, assemblePaletteOptions);
var assembleDraggableEdge = drawSvgDraggableEdge(assembleSvg);
var assembleSvgDimensions = drawSvgDimensionLabel(assembleSvg);
d3.select("#assembleSvgOptimizeBar")
	.style("left", config.stripTableWidth + "px")
	.style("width", (assembleSvg.node().parentNode.clientWidth - config.stripTableWidth - 2) + "px");

var assembleSvgOptimizeLabel = d3.select("#assembleSvgOptimizeBar .h4");
var nextOptimizeBtn = d3.select("#nextOptimizeBtn");
var cancelConstraintBtn = d3.select("#cancelConstraintBtn")
.on("click", exitConstraintSelection);
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

var traceFo = tracePaletteContainer.append("foreignObject")
	.attr("height", config.standardHeight)
	.attr("width", config.stripTableWidth)
	.append("xhtml:body").classed("strip-table", true)
	.attr("xmlns", "http://www.w3.org/1999/xhtml")
	.append("div").classed("paletteTablePadded", true);

traceFo.append("h4")
	.html("Export Strips <a href='/docs.html#exportStrip' target='_blank'><i class='fa fa-question-circle'></i></a>");

var resetAllStrips = traceFo.append("span")
	.append("div")
	.attr("id", "resetAllStrips").style("margin-left", "10px").style("display", "none")
	.html("<a href='#' class='strip-table-x'><i class='fa fa-times'></i></a> Reset all strips");

resetAllStrips.select("a")
	.on("click", function() {
		colorMap = [];
		d3.selectAll(".strip-below, .strip-above").style("stroke", "gainsboro");
		updateStripTable();
		resetAllStrips.style("display", "none");
		noneSoFar.style("display", "block");
	});

var sidebarForm = traceFo
	.append("form").classed("form-horizontal", true);

var noneSoFar = traceFo
	.append("div")
	.attr("id", "noneSoFar")
	.html("Strips you assign colors to will show up here!");

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

var optimizeDesign = d3.select("#optimizeDesign")
	.on("click", optimizeDesignClick);

d3.select("#exitOptimizeView").on("click", exitOptimizeView);

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
			.classed("col-sm-4 padded-col", true);
		col.append("div").classed("image-frame", true)
			.append("div").classed("horiz-centered responsive-sprites", true)
			.append("img")
			.attr("src", "images/sprites/starter-sprite.jpg")
			.classed("icon-" + opt.file, true)
			.attr("alt", opt.name);
		col.append("a").classed("image-frame overlap-full", true)
			.attr("href", "#")
			.on("click", function() {
				$("#newModal").modal("hide");
				$.getJSON("/slfm_files/starter/" + opt.file + ".slfm")
				.done(function(data) {
					loadFromJson(data, function() {});
				})
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
	polylist = [];
	assembleCanvas.selectAll("g").remove();
});

assembleSVGDrawer.set([]);
assembleSVGDrawer.draw();

_.each(tileOptions, function(opts, name) {
	_.each(opts, generateHtml("#" + name));
});

var patternDropdown = d3.select("#patternDropdown");
_.each(patternOptions, function(opt) {
	if (opt.name === "Infer") {
		opt.betaFeature = true;
		opt.betaHidden = true;
	}
});

// set listeners on custom shape UI elements

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

d3.selectAll("#assembleOrigZoom, #traceOrigZoom")
.on("click", originalZoomHandler);

d3.selectAll("#assembleZoomToFit, #traceZoomToFit")
.on("click", zoomToFitHandler);

d3.selectAll(".svg-toolbar").style("display", "block");

$("#assembleOrigZoom, #traceOrigZoom, #assembleZoomToFit, #traceZoomToFit").tooltip({container: 'body#body'});

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

$("#customPatternSelect").change(updateUIForCustomTemplateWithDefault)
.focus(updateUIForCustomTemplateWithDefault);

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
}).on("change", patternUpdate);

var endOffset = new Slider('#endOffset', {
	value: 0,
	min: -0.5,
	max: 0.5,
	step: 0.01,
	formatter: function(value) {
		return 'Current value: ' + value;
	}
}).on("change", patternUpdate);

$('form input[name=symmetryRadios][type=radio]')
.change(patternUpdate);

$('form input[name=edgeRadios][type=radio]')
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

$("#patternInterval, #patternStart, #patternDepth")
.focus(function() {
	$(":radio[value=auto]").prop("checked", true);
	patternUpdate();
}).blur(patternUpdate);

$("#manualEdges").focus(function() {
	$(":radio[value=manual]").prop("checked", true);
	patternUpdate();
}).blur(patternUpdate);

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

$("#betaFeaturesBtn").click(function() {
	$("#betaFeaturesModal").modal('show');
	d3.select("#betaError").style("display", "none");
});

// set listener on strip view UI elements

var colorPalette = [[{"name":"Red","hex":"F44336"},{"name":"Pink","hex":"E91E63"},{"name":"Purple","hex":"9C27B0"},{"name":"Deep Purple","hex":"673AB7"},{"name":"Indigo","hex":"3F51B5"},{"name":"Blue","hex":"2196F3"},{"name":"Light Blue","hex":"03A9F4"},{"name":"Cyan","hex":"00BCD4"},{"name":"Teal","hex":"009688"},{"name":"Green","hex":"4CAF50"},{"name":"Light Green","hex":"8BC34A"},{"name":"Lime","hex":"CDDC39"},{"name":"Yellow","hex":"FFEB3B"},{"name":"Amber","hex":"FFC107"},{"name":"Orange","hex":"FF9800"},{"name":"Deep Orange","hex":"FF5722"},{"name":"Brown","hex":"795548"},{"name":"Blue Grey","hex":"607D8B"},{"name":"Grey","hex":"9E9E9E"}],[{"name":"Red 100","hex":"FFCDD2"},{"name":"Pink 100","hex":"F8BBD0"},{"name":"Purple 100","hex":"E1BEE7"},{"name":"Deep Purple 100","hex":"D1C4E9"},{"name":"Indigo 100","hex":"C5CAE9"},{"name":"Blue 100","hex":"BBDEFB"},{"name":"Light Blue 100","hex":"B3E5FC"},{"name":"Cyan 100","hex":"B2EBF2"},{"name":"Teal 100","hex":"B2DFDB"},{"name":"Green 100","hex":"C8E6C9"},{"name":"Light Green 100","hex":"DCEDC8"},{"name":"Lime 100","hex":"F0F4C3"},{"name":"Yellow 100","hex":"FFF9C4"},{"name":"Amber 100","hex":"FFECB3"},{"name":"Orange 100","hex":"FFE0B2"},{"name":"Deep Orange 100","hex":"FFCCBC"},{"name":"Brown 100","hex":"D7CCC8"},{"name":"Blue Grey 100","hex":"CFD8DC"},{"name":"Grey 100","hex":"F5F5F5"}],[{"name":"Red 300","hex":"E57373"},{"name":"Pink 300","hex":"F06292"},{"name":"Purple 300","hex":"BA68C8"},{"name":"Deep Purple 300","hex":"9575CD"},{"name":"Indigo 300","hex":"7986CB"},{"name":"Blue 300","hex":"64B5F6"},{"name":"Light Blue 300","hex":"4FC3F7"},{"name":"Cyan 300","hex":"4DD0E1"},{"name":"Teal 300","hex":"4DB6AC"},{"name":"Green 300","hex":"81C784"},{"name":"Light Green 300","hex":"AED581"},{"name":"Lime 300","hex":"DCE775"},{"name":"Yellow 300","hex":"FFF176"},{"name":"Amber 300","hex":"FFD54F"},{"name":"Orange 300","hex":"FFB74D"},{"name":"Deep Orange 300","hex":"FF8A65"},{"name":"Brown 300","hex":"A1887F"},{"name":"Blue Grey 300","hex":"90A4AE"},{"name":"Grey 300","hex":"E0E0E0"}],[{"name":"Red 700","hex":"D32F2F"},{"name":"Pink 700","hex":"C2185B"},{"name":"Purple 700","hex":"7B1FA2"},{"name":"Deep Purple 700","hex":"512DA8"},{"name":"Indigo 700","hex":"303F9F"},{"name":"Blue 700","hex":"1976D2"},{"name":"Light Blue 700","hex":"0288D1"},{"name":"Cyan 700","hex":"0097A7"},{"name":"Teal 700","hex":"00796B"},{"name":"Green 700","hex":"388E3C"},{"name":"Light Green 700","hex":"689F38"},{"name":"Lime 700","hex":"AFB42B"},{"name":"Yellow 700","hex":"FBC02D"},{"name":"Amber 700","hex":"FFA000"},{"name":"Orange 700","hex":"F57C00"},{"name":"Deep Orange 700","hex":"E64A19"},{"name":"Brown 700","hex":"5D4037"},{"name":"Blue Grey 700","hex":"455A64"},{"name":"Grey 700","hex":"616161"}],[{"name":"Red 900","hex":"B71C1C"},{"name":"Pink 900","hex":"880E4F"},{"name":"Purple 900","hex":"4A148C"},{"name":"Deep Purple 900","hex":"311B92"},{"name":"Indigo 900","hex":"1A237E"},{"name":"Blue 900","hex":"0D47A1"},{"name":"Light Blue 900","hex":"01579B"},{"name":"Cyan 900","hex":"006064"},{"name":"Teal 900","hex":"004D40"},{"name":"Green 900","hex":"1B5E20"},{"name":"Light Green 900","hex":"33691E"},{"name":"Lime 900","hex":"827717"},{"name":"Yellow 900","hex":"F57F17"},{"name":"Amber 900","hex":"FF6F00"},{"name":"Orange 900","hex":"E65100"},{"name":"Deep Orange 900","hex":"BF360C"},{"name":"Brown 900","hex":"3E2723"},{"name":"Blue Grey 900","hex":"263238"},{"name":"Grey 900","hex":"212121"}]];
var flatColorPalette = _.flatten(colorPalette);
var spectrumPalette = _.map(colorPalette, function(row) { return _.pluck(row, "hex"); });

var colorMap = [];

var exportSvg = d3.select("#exportSvg")
.on("click", exportSvgHandler);

d3.select("#exportPngMenu").selectAll("li.exportPng").data([
	{factor: 0.5, title: "Small"},
	{factor: 1, title: "Medium"},
	{factor: 2, title: "Large"},
	{factor: 4, title: "Very large"}])
.enter().insert("li", ":first-child").order().classed("exportPng", true)
.append("a").attr("href", "#")
.on("click", exportPngHandler);

d3.select("#exportImageDropdown").on("click", function() {
	d3.select("#exportPngMenu").selectAll("li.exportPng").selectAll("a").text(function(d) {
		var width = traceSvg.node().parentNode.clientWidth - config.stripTableWidth;
		var height = traceSvg.attr("height");
		return d.title + " (" + Math.round(width * d.factor) + " x " + Math.round(height * d.factor) + ")";
	});
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

var toggleStripSettingsBtn = d3.select("#toggleStripSettings")
.on("click", function() {
	d3.select("#stripSettings").classed("hidden", false);
	$("#toggleStripSettings").text(d3.select("#stripSettings").classed("in") ? "Show parameters" : "Hide parameters");
	$("#stripSettings").collapse('toggle');
});

var stripSvgInput = [];

var stripHeight = new Slider("#stripHeight", {
	min: 10,
	max: 50,
	step: 1,
	value: 15,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
}).on("change", stripSvgSliderChange);

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
}).on("change", stripSvgSliderChange);

var interSpacing = new Slider("#interSpacing", {
	min: 0,
	max: 50,
	step: 1,
	value: 15,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
}).on("change", stripSvgSliderChange);

var printHeight = new Slider("#printHeight", {
	min: 0,
	max: 3000,
	step: 10,
	value: 1620,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
}).on("change", stripSvgSliderChange);

var printWidth = new Slider("#printWidth", {
	min: 0,
	max: 3000,
	step: 10,
	value: 2880,
	formatter: function(value) {
		var mm = Math.round(value / config.pixelToMm * 10) / 10;
		return value + " px = " + mm + " mm";
	}
}).on("change", stripSvgSliderChange);

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
	max: 0.8,
	step: 0.01,
	value: 0.3,
	formatter: function(value) {
		var pixels = value * config.sidelength * widthFactor.getValue();
		var mm = Math.round(pixels / config.pixelToMm * 10) / 10;
		return Math.round(pixels) + " px = " + mm + ' mm';
	}
}).on("change", extensionSliderChange);

$("#patternInferSwitch").bootstrapSwitch({state: false})
.on('switchChange.bootstrapSwitch', function() {
	var inferPatternObject = _.find(patternOptions, function(opt) { return opt.name === "Infer"; });
	if ($("#patternInferSwitch").bootstrapSwitch("state")) {
		inferPatternObject.betaHidden = false;
		d3.selectAll("#inferContainer").classed("betaHidden", false);
	} else {
		if (_.any(assembleSVGDrawer.get(), "infer")) {
			// error
			d3.select("#betaError").style("display", "block")
			.html("<i class='fa fa-exclamation-triangle'></i> You cannot turn this feature off when there are still tiles with inferred patterns in the palette!");
			$("#patternInferSwitch").bootstrapSwitch("state", true);
		} else {
			inferPatternObject.betaHidden = true;
			d3.selectAll("#inferContainer").classed("betaHidden", true);
		}
	}
});

$("#nonPlanarSwitch").bootstrapSwitch({state: false})
.on('switchChange.bootstrapSwitch', function() {
	if ($("#nonPlanarSwitch").bootstrapSwitch("state")) {
		// turn it on
		d3.selectAll("#planarContainer").classed("betaHidden", false);
	} else {
		var nonPlanarEdgeJoinsExist = false;
		d3.selectAll(".edge.joined").each(function(d) {
			nonPlanarEdgeJoinsExist = nonPlanarEdgeJoinsExist || !d.joinedTo.isPlanar;
		});
		if (nonPlanarEdgeJoinsExist) {
			// error
			d3.select("#betaError").style("display", "block")
			.html("<i class='fa fa-exclamation-triangle'></i> You cannot turn this feature off when there are still non-planar edge joins on the canvas!");
			$("#nonPlanarSwitch").bootstrapSwitch("state", true);
		} else {
			d3.selectAll("#planarContainer").classed("betaHidden", true);
		}
	}
});

$("#patternCroppingSwitch").bootstrapSwitch({state: false})
.on('switchChange.bootstrapSwitch', function() {
	if ($("#patternCroppingSwitch").bootstrapSwitch("state")) {
		// turn it on
		d3.selectAll("#cropContainer").classed("betaHidden", false);
	} else {
		if (cropData.hullEdges.length > 2 && $("#cropMode").bootstrapSwitch("state")) {
			// error
			d3.select("#betaError").style("display", "block")
			.html("<i class='fa fa-exclamation-triangle'></i> Turning off this feature will reset your existing cropping selection.");
		}
		d3.selectAll("#cropContainer").classed("betaHidden", true);
	}
});

$("#jsonStripGenSwitch").bootstrapSwitch({state: false})
.on('switchChange.bootstrapSwitch', function() {
	d3.selectAll("#customStripPanel").classed("betaHidden", !$("#jsonStripGenSwitch").bootstrapSwitch("state"));
	if ($("#jsonStripGenSwitch").bootstrapSwitch("state")) {
		stripViewClick();
		document.getElementById("customStripPanel").scrollIntoView();
	}
});

$("#outlineToggle").bootstrapSwitch()
.on('switchChange.bootstrapSwitch', function() {
	d3.selectAll("path.strip-outline")
	.attr("visibility", $("#outlineToggle").bootstrapSwitch("state") ? "visible" : "hidden");
});

$(".collapse").collapse({toggle: true});

d3.select("#generateCustomStripBtn")
  .on("click", generateCustomStrip);

bootbox.setDefaults({
	container: "body#body"
});

var currentFilename = "my_design";

// wrap jQuery plugins in document.ready
var patternSelectize;

var fixSpectrumTooltips = function() {
	_.each($(".sp-container"), function(container) {
		_.map(_.zip(flatColorPalette, $(container).find(".sp-palette .sp-thumb-el")), function(pair) {
			if (pair[0] && pair[1]) {
				$(pair[1]).attr("title", pair[0].name);
			}
		});
	});
};

$(document).ready(function() {

	// use local storage for shared palettes between all color pickers
	// but don't persist it between sessions
	localStorage.removeItem("spectrum.sliceformstudio");

	$("#spectrum").spectrum({
		appendTo: "#body",
		color: flatColorPalette[0].hex,
		showPaletteOnly: true,
		showInput: true,
		showButtons: false,
		preferredFormat: "rgb",
		togglePaletteOnly: true,
		togglePaletteMoreText: 'More',
		togglePaletteLessText: 'Less',
		palette: spectrumPalette,
		change: function(color) {
			stylesheet.deleteRule(0);
			stylesheet.insertRule("path.strip.hover { stroke: " + color.toHexString() + " !important }", 0);
		},
		show: fixSpectrumTooltips,
		localStorageKey: "spectrum.sliceformstudio"
	});

	$(".sp-palette-button-container button").on("click", fixSpectrumTooltips);

	$("#spectrum").on("dragstop.spectrum", function(e, color) {
		stylesheet.deleteRule(0);
		stylesheet.insertRule("path.strip.hover { stroke: " + color.toHexString() + " !important }", 0);
		fixSpectrumTooltips();
	});

    var openTime = new Date().getTime();

	$("#patternDropdown").selectize({
		valueField: "index",
		labelField: "name",
		sortField: "index"
	})
	.on("change", patternDropdownChange);
	patternSelectize = $("#patternDropdown")[0].selectize;

	$("#autoSnap").bootstrapSwitch({
		onInit: function() {
			var label = d3.select(this.parentNode).select(".bootstrap-switch-label");
			label.html(label.text() + " <a href='#' id='autoSnapHint'><i class='fa fa-question-circle'></a>");
			$("#autoSnapHint").click(function(e) {
				bootbox.alert({
					title: "Planar tilings only",
					message: "<p>Under normal circumstances, Sliceform Studio will forbid you from joining two edges belonging to the same tile or to tiles in the same group. You can disable this check by turning off 'Planar' in the toolbar. Now when you click on two edges in succession, the two tiles will no longer snap together, but the edges will still turn green to indicate that they are now joined.</p> <p>This is useful for creating non-planar configurations like cylinders, polyhedra and other configurations where edges are identified in topologically interesting ways. Refer to Rampart or Planetarium in the <a href='/gallery'>gallery</a> as examples of this.</p>"
				});
				// to compensate for click event registering on switch as well
				$("#autoSnap").bootstrapSwitch("toggleState", true);
			});
		}
	});

	$("#cropMode").bootstrapSwitch().on('switchChange.bootstrapSwitch', cropModeToggle);

	stylesheet.insertRule("path.strip.hover { stroke: " + $("#spectrum").spectrum('get').toHexString() + " !important }", 0);

	var loadOrNewFile = function() {
		var params = getUrlVars();
		if (params.optimize) {
			d3.select("#cropContainer").classed("betaHidden", false);
		}
		if (params.template) {
			if (params.template.search(/^\w+$/) >= 0) {
				d3.select(".loading-overlay").classed("in", true);
				$.getJSON("/slfm_files/gallery/" + params.template + ".slfm")
				.done(function(data) {
					loadFromJson(data, function() {
						currentFilename = params.template;
						if (params.strips) {
							stripViewClick();
						}
					});
				})
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
	};

	if (window.innerWidth < 1024) {
		bootbox.alert({
			title: "Warning: screen size",
			message: "Sliceform Studio is designed to be accessed with screens of width 1200px and above. Some functionality may be inaccessible on smaller screens.",
			callback: loadOrNewFile
		});
	} else {
		loadOrNewFile();
	}

});

// end brace from foreignobject test
}
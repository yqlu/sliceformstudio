var wallpaperVersion = 0.2;
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
	.call(zoomPalette);

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

var traceSvg = buildSvg("#traceSvg", config.standardWidth, config.standardHeight);
var traceBg = buildBg(traceSvg, true, true, commonZoomHandler);
var traceCanvas = buildDisplay(traceSvg, assembleCanvas.datum().transform, true); // ensure they zoom the same amount

// set listeners on tile / strip view toggles
var tileView = d3.select("#tileView")
.on("click", tileViewClick);

var stripView = d3.select("#stripView")
.on("click", stripViewClick);

var cropView = d3.select("#cropView")
.on("click", cropViewClick);

// set listeners on tile view UI elements

var saveButton = d3.select("#saveFile")
.on("click", saveToFile);
$(saveButton[0]).tooltip({container: 'body#body'});

var loadButton = d3.select("#loadFile");
$(loadButton[0]).tooltip({container: 'body#body'});

$("#loadFileInput")
.on("change", loadFromFile);

var inferButton = d3.select("#infer")
	.on("click", inferHandler)
	.classed("hidden", true);

var clearButton = d3.select("#clear")
	.on("click", clearHandler);
$(clearButton[0]).tooltip({container: 'body#body'});

var addButton = d3.select("#addShape")
	.on("click", function() {
		$("#customShapeModal").modal();
	});
$(addButton[0]).tooltip({container: 'body#body'});

var deleteButton = d3.select("#delete")
	.on("click", deleteHandler);
$(deleteButton[0]).tooltip({container: 'body#body'});

var copyButton = d3.select("#copy")
	.on("click", copyHandler);
$(copyButton[0]).tooltip({container: 'body#body'});

d3.select("#selectAll").on("click", cropSelectAll);
d3.select("#unselectAll").on("click", cropUnselectAll);

// initializing dropdown options
var shapeOptionsBuilder = (function() {
	var theta = Math.PI / 5;
	var phi = (1 + Math.sqrt(5)) / 2;
	return [
		{
			category: "Regular polygons",
			options: [{
				name: "Triangles, squares and hexagons",
				polygons: function() {
					return regularPolygonList([3,4,6]);
				},
			}, {
				name: "Squares and octagons",
				polygons: function() { return regularPolygonList([4, 8]); },
			}, {
				name: "Triangles, hexagons, squares and 12-gons",
				polygons: function() { return regularPolygonList([3, 4, 6, 12]); },
			}]
		}, {
			category: "Regular polygons with fillers",
			options: [{
				name: "10-gons with fillers",
				polygons: function() { return [regularPolygon(10), polygonFromAngles([2/5 * Math.PI, 2/5 * Math.PI, 6/5 * Math.PI, 2/5 * Math.PI, 2/5 * Math.PI, 6/5 * Math.PI], -Math.PI / 10)]; },
			}, {
				name: "12-gons with fillers",
				polygons: function() { return [regularPolygon(12), polygonFromAngles([7/6 * Math.PI, 1/3 * Math.PI, 7/6 * Math.PI, 1/3 * Math.PI, 7/6 * Math.PI, 1/3 * Math.PI, 7/6 * Math.PI, 1/3 * Math.PI], -Math.PI/6)]; },
			}, {
				name: "Octagons, 12-gons with fillers",
				polygons: function() { return [regularPolygon(8), regularPolygon(12), polygonFromAngles([5/12 * Math.PI, 5/12 * Math.PI, 7/6 * Math.PI, 5/12 * Math.PI, 5/12 * Math.PI, 7/6 * Math.PI], -1/12 * Math.PI)]; },
			}, {
				name: "Nonagons, 12-gons with fillers",
				polygons: function() { return [regularPolygon(9), regularPolygon(12), polygonFromAngles([7/18 * Math.PI, 7/18 * Math.PI, 11/9 * Math.PI, 7/18 * Math.PI, 7/18 * Math.PI, 11/9 * Math.PI], -1/9 * Math.PI)]; },
			}, {
				name: "Octagons, 16-gons with fillers",
				polygons: function() { return [regularPolygon(16), regularPolygon(8), polygonFromAngles([9/8 * Math.PI, 9/8 * Math.PI, 3/8 * Math.PI, 3/8 * Math.PI, 9/8 * Math.PI, 9/8 * Math.PI, 3/8 * Math.PI, 3/8 * Math.PI], Math.PI / 8)]; },
			}, {
				name: "18-gons with fillers",
				polygons: function() { return [regularPolygon(18), polygonFromAngles([10/9 * Math.PI, 2/9 * Math.PI, 10/9 * Math.PI, 2/9 * Math.PI, 10/9 * Math.PI, 2/9 * Math.PI], -5/18 * Math.PI)]; },
			}]
		}, {
			category: "Almost-regular polygons",
			options: [{
				name: "Heptagons and pentagons",
				polygons: function() { return [regularPolygon(7), polygonFromAnglesAndLengths([9/14*Math.PI, 4/7 * Math.PI, 4/7 * Math.PI, 4/7 * Math.PI, 9/14*Math.PI], [0.696,1,1,1,1], Math.PI)]; },
			}, {
				name: "Altair tiling",
				polygons: function() { return [regularPolygon(8), regularPolygon(6),
					polygonFromAnglesAndLengths([Math.PI * 7/12, 1.858841670477, 2.04190319062728, 1.858841670477, Math.PI * 7/12], [1,1,0.89,0.89, 1], Math.PI),
					polygonFromAnglesAndLengths([Math.PI/2, Math.PI/2, Math.PI/2, Math.PI/2], [0.896533685752634, 0.896533685752634, 0.896533685752634, 0.896533685752634]),
					polygonFromAnglesAndLengths([3/4*Math.PI, 2.12064105827615, 2.32994853430939, Math.PI * 2/3, 2.32994853430939, 2.12064105827615, 3/4 * Math.PI], [0.896533685752634, 0.896533685752634, 0.89, 1, 1, 0.89, 0.896533685752634], Math.PI)
					]; }
			}]
		}, {
			category: "Quasiperiodic tilings",
			options: [{
				name: "Pentagons and rhombi",
				polygons: function() { return [regularPolygon(5), polygonFromAngles([1/5*Math.PI, 4/5 * Math.PI, 1/5 * Math.PI, 4/5 * Math.PI], Math.PI / 10)]; },
			}, {
				name: "Heptagonal rhombi",
				polygons: function() { return [polygonFromAnglesAndLengths([2/7*Math.PI, 5/7 * Math.PI, 2/7 * Math.PI, 5/7 * Math.PI], [2,2,2,2],0), polygonFromAnglesAndLengths([3/7*Math.PI, 4/7 * Math.PI, 3/7 * Math.PI, 4/7 * Math.PI], [2,2,2,2],0), polygonFromAnglesAndLengths([1/7*Math.PI, 6/7 * Math.PI, 1/7 * Math.PI, 6/7 * Math.PI], [2,2,2,2],0)]; },
			}, {
				name: "Penrose rhombi",
				polygons: function() { return [polygonFromAngles([theta, 4*theta, theta, 4*theta], theta / 2), polygonFromAngles([2*theta, 3*theta, 2*theta, 3*theta], theta)]; },
			}, {
				name: "Penrose kites and darts",
				polygons: function() { return [polygonFromAnglesAndLengths([2*theta, 4*theta, 2*theta, 2*theta], [phi, 1, 1, phi], -Math.PI/2 - theta), polygonFromAnglesAndLengths([theta, 2*theta, theta, 6*theta], [1, phi, phi, 1], -theta/2)]; },
			}, {
				name: "Girih tiles",
				polygons: function() { return [regularPolygon(10), regularPolygon(5), polygonFromAngles([2*theta, 3*theta, 2*theta, 3*theta]),
					polygonFromAngles([6*theta, 2*theta, 2*theta, 6*theta, 2*theta, 2*theta]),
					polygonFromAngles([2*theta, 4*theta, 4*theta, 2*theta, 4*theta, 4*theta])];
				}
			}]
		}];
})();

var shapeOptions = _.flatten(_.pluck(shapeOptionsBuilder, "options")).concat({name: "Custom", polygons: function() { return []; }});

var shapeDropdown = d3.select("#shapeDropdown");

shapeDropdown.selectAll("optgroup").data(shapeOptionsBuilder).enter()
	.append("optgroup")
	.attr("label", function(d) { return d.category; })
	.selectAll("option").data(function(d) { return d.options; }).enter()
	.append("option")
	.html(function(d) {return d.name;});

shapeDropdown.append("option").html("Custom");

shapeDropdown.selectAll("option")
	.attr("value", function(d, i) {return i;});

var patternDropdown = d3.select("#patternDropdown");

patternDropdown.selectAll("option").data(patternOptions).enter()
	.append("option")
	.attr("value", function(d, i) {return i;})
	.html(function(d) {return d.name;});

// set listeners on custom shape UI elements

var shapeEditToggleButton = d3.select("#shapeEditToggle")
	.on("click", shapeEditToggle);

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

var displayHeight = new Slider("#displayHeight", {
	min: 300,
	max: 1200,
	step: 10,
	value: 500,
	formatter: function(value) {
		return value + " px";
	}
}).on("change", displayHeightChange);

var thicknessSlider = new Slider("#thickness", {
	min: 0,
	max: 10,
	step: 0.1,
	value: 3,
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
		var pixels = value * widthFactor.getValue(); //parseFloat($("#widthFactor").val());
		var mm = Math.round(pixels / config.pixelToMm * 10) / 10;
		return mm + ' mm';
	}
}).on("change", extensionSliderChange);

var outlineToggle = d3.select("#outlineToggle")
.on("click", function() {
	d3.selectAll("path.strip-outline")
	.attr("visibility", outlineToggle.classed("active") ? "hidden" : "visible");
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

	$("#shapeDropdown").select2({
		minimumResultsForSearch: Infinity
	})
	.on("select2:select", shapeDropdownChange).trigger("select2:select");

	$("#patternDropdown").select2({
		minimumResultsForSearch: Infinity
	})
	.on("change", patternDropdownChange);

	$("#autoSnap").bootstrapSwitch();

	$("#cropMode").bootstrapSwitch().on('switchChange.bootstrapSwitch', cropModeToggle);

	stylesheet.insertRule("path.strip.hover { stroke: " + $("#colorpicker").val() + " !important }", 0);

	var params = getUrlVars();
	if (params.template) {
		if (params.template.search(/^\w+$/) >= 0) {
			$.getJSON("/images/gallery/wlpr_files/" + params.template + ".wlpr")
			.done(loadFromJson)
			.error(function() {
				bootbox.alert("Error: " + params.template + " is not a valid template.");
			});
		} else {
			bootbox.alert("Error: " + params.template + " is not a valid template.");
		}
	}
});
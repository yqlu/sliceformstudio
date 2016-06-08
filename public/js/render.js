var thickSvgMode = false;

var genSVG = function(strips, options) {
	var transform = options.resetTransform ? num.id :
		((d3.select(options.selector + " .canvas").node() && d3.select(options.selector + " .canvas").node().__data__.transform) || num.id);

	var xOffset = 5;
	var yOffset = 5;
	var size = [options.printWidth, options.printHeight];
	var colors = ['#ff0000','#000000','#0000ff'];
	var height = options.stripHeight;

	var style = "fill:none;stroke-width:0.1;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none";
	var scorestyle = "stroke:" + colors[0] + ";" + style;
	var cutstyle = "stroke:" + colors[1] + ";" + style;
	var stripstyle = "stroke:" + colors[2] + ";" + style;

	d3.select(options.selector).selectAll("svg").remove();
	var svg = d3.select(options.selector).append("svg")
		.attr("width", size[0])
		.attr("height", size[1])
		.attr("version", 1.1);

	var canvas;

	if (options.forDisplay) {
		var bg = buildBg(svg, true, false, d3.behavior.zoom().on("zoom", zoomBehavior));
		canvas = buildDisplay(svg, transform, true);
	} else {
		canvas = svg;
	}

	svg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
	svg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");

	_.each(strips, function(strip) {
		var width = 0;
		var topHalf = [yOffset, yOffset + height / 2];
		var bottomHalf = [yOffset + height / 2, yOffset + height];
		var full = [yOffset, yOffset + height];
		var parity = false;

		_.each(strip, function(segment, idx) {
			_.each(segment, function(space, idy) {
				width += space * options.widthFactor;
				if (idy !== segment.length - 1) {
					// cut half lines
					var height1 = parity ? topHalf[0] : bottomHalf[0];
					var height2 = parity ? topHalf[1] : bottomHalf[1];
					parity = !parity;
					var style = cutstyle;
					var thickLineOffset = 0.54;
					if (thickSvgMode) {
						canvas.append("line")
						.attr({
							x1: function(d) {return xOffset + width - thickLineOffset;},
							y1: function(d) {return height1;},
							x2: function(d) {return xOffset + width - thickLineOffset;},
							y2: function(d) {return height2;}
						})
						.attr("style", cutstyle);
						canvas.append("line")
						.attr({
							x1: function(d) {return xOffset + width + thickLineOffset;},
							y1: function(d) {return height1;},
							x2: function(d) {return xOffset + width + thickLineOffset;},
							y2: function(d) {return height2;}
						})
						.attr("style", cutstyle);
					}
					canvas.append("line")
					.attr({
						x1: function(d) {return xOffset + width;},
						y1: function(d) {return height1;},
						x2: function(d) {return xOffset + width;},
						y2: function(d) {return height2;}
					})
					.attr("style", cutstyle);
				}
			});
			if (idx !== strip.length - 1) {
				// score full lines
				canvas.append("line")
				.attr({
					x1: function(d) {return xOffset + width;},
					y1: function(d) {return full[0];},
					x2: function(d) {return xOffset + width;},
					y2: function(d) {return full[1];}
				})
				.attr("style", scorestyle);
			}
		});
		// cut out entire strip
		var hole = height / 8;

		var stripEdges = [[[xOffset, yOffset], [xOffset+width, yOffset]],
			[[xOffset, yOffset+height], [xOffset+width, yOffset+height]],
			[[xOffset, yOffset+hole], [xOffset, yOffset+height]],
			[[xOffset+width, yOffset], [xOffset+width, yOffset+height-hole]]];
		_.each(stripEdges, function(edge) {
			canvas.append("line")
			.attr({
				x1: function(d) {return edge[0][0];},
				y1: function(d) {return edge[0][1];},
				x2: function(d) {return edge[1][0];},
				y2: function(d) {return edge[1][1];}
			})
			.attr("style", stripstyle);
		});

		yOffset += options.stripHeight + options.interSpacing;
	});
};

var exportImageInTmpSvg = function() {
	d3.select("#tmpSvg").selectAll("svg").remove();
	var tmpSvg = d3.select("#tmpSvg").append("svg")
		.attr("width", traceSvg.node().parentNode.clientWidth - config.stripTableWidth)
		.attr("height", traceSvg.attr("height"))
		.attr("version", 1.1);

	tmpSvg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
	tmpSvg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");

	var stripsCopy = traceSvg.select(".display.canvas").node().cloneNode(true);
	stripsCopy.__data__ = {transform: _.cloneDeep(traceSvg.select(".display.canvas").node().__data__.transform)};
	stripsCopy.__data__.transform = num.translateBy(stripsCopy.__data__.transform, - config.stripTableWidth, 0);
	d3.select(stripsCopy).attr("transform", num.getTransform);
	tmpSvg.node().appendChild(traceBg.node().cloneNode(false));
	tmpSvg.node().appendChild(stripsCopy);
	return tmpSvg.node();
};
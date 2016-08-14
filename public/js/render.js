var thickSvgMode = false;

var genSVG = function(strips, options) {
	var transform = options.resetTransform ? num.id :
		((d3.select(options.selector + " .canvas").node() && d3.select(options.selector + " .canvas").node().__data__.transform) || num.id);

	var xOffset = 5;
	var yOffset = 5;
	var margin = {top: 25, left: 60, right: 0, bottom: 0};
	var svgSize = options.forDisplay ? [950, 450] : [options.printWidth, options.printHeight];
	var size = options.forDisplay ? [950 - margin.left - margin.right, 500 - margin.top - margin.bottom] : svgSize;
	var colors = ['#ff0000','#000000','#0000ff'];
	var height = options.stripHeight;

	var style = "fill:none;stroke-width:0.1;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none";
	var scorestyle = "stroke:" + colors[0] + ";" + style;
	var cutstyle = "stroke:" + colors[1] + ";" + style;
	var stripstyle = "stroke:" + colors[2] + ";" + style;

	d3.select(options.selector).selectAll("svg").remove();
	var svg = d3.select(options.selector).append("svg")
		.attr("width", svgSize[0])
		.attr("height", svgSize[1])
		.attr("version", 1.1);

	var canvas, zoom;

	if (options.forDisplay) {
		var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		var invTransform = num.inv(transform);

		var x = d3.scale.linear()
		.domain([0, size[0]])
		.range([0, size[0]]);

		var y = d3.scale.linear()
		.domain([0, size[1]])
		.range([0, size[1]]);

		var xAxis = d3.svg.axis()
		.scale(x)
		.tickFormat(function(d) { return d + "px"; })
		.orient("top");

		var yAxis = d3.svg.axis()
		.scale(y)
		.tickFormat(function(d) { return d + "px"; })
		.orient("left");

		var scaleFactor = transform[0][0];

		zoom = d3.behavior.zoom()
		.scaleExtent([0.1,10])
		.x(x)
		.y(y)
		.scale(transform[0][0])
		.translate([transform[0][2],transform[1][2]])
		.on("zoom", function(d, i) {
			//cap translation to panning limits
			var panExtentBorder = 20;
			var translate = zoom.translate();
			translate[0] = Math.max(- (panExtentBorder + options.printWidth * zoom.scale() - size[0]), translate[0]);
			translate[0] = Math.min(panExtentBorder, translate[0]);
			translate[1] = Math.max(- (panExtentBorder + options.printHeight * zoom.scale() - size[1]), translate[1]);
			translate[1] = Math.min(panExtentBorder, translate[1]);
			zoom.translate(translate);

			var canvas = d3.select(this.parentNode).selectAll(".canvas");
			canvas.each(function(d) {
				d.transform = num.matrixRound(num.translateBy(num.scaleBy(num.id, zoom.scale()), zoom.translate()[0], zoom.translate()[1]));
			})
			.attr("transform", num.getTransform);
			canvas.selectAll("line, rect")
			.style("stroke-width", 1 / zoom.scale());
			d3.select(this.parentNode).select(".x.axis").call(xAxis);
			d3.select(this.parentNode).select(".y.axis").call(yAxis);
		});

		var bg = buildBg(g, true, false, zoom);
		canvas = buildDisplay(g, transform, true);

		// add white rectangles to mask out strips underneath the axes
		g.append("rect").classed("axisMask", true)
		.attr("width", "100%")
		.attr("height", margin.top)
		.attr("x", -margin.left)
		.attr("y", -margin.top);

		g.append("rect").classed("axisMask", true)
		.attr("width", margin.left)
		.attr("height", "100%")
		.attr("x", -margin.left)
		.attr("y", -margin.top);

		// actually create axes
		g.append("g")
		.attr("class", "x axis")
		.call(xAxis);
		g.append("g")
		.attr("class", "y axis")
		.call(yAxis);

		// draw outline of paper sheet
		canvas.append("rect")
		.attr({
			x: 0,
			y: 0,
			width: options.printWidth,
			height: options.printHeight
		})
		.style({
			fill: "none",
			stroke: "black"
		});

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
						canvas.append("line")
						.attr({
							x1: function(d) {return xOffset + width - thickLineOffset;},
							y1: function(d) {return topHalf[1];},
							x2: function(d) {return xOffset + width + thickLineOffset;},
							y2: function(d) {return topHalf[1];}
						})
						.attr("style", cutstyle);
					} else {
						canvas.append("line")
						.attr({
							x1: function(d) {return xOffset + width;},
							y1: function(d) {return height1;},
							x2: function(d) {return xOffset + width;},
							y2: function(d) {return height2;}
						})
						.attr("style", cutstyle);
					}
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

	if (options.forDisplay) {
		canvas.selectAll("line, rect")
		.style("stroke-width", 1 / zoom.scale());
	}
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
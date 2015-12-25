var genSVG = function(strips, options) {
	var xOffset = 5;
	var yOffset = 5;
	var size = [options.printWidth, options.printHeight];
	var colors = ['#ff0000','#000000','#0000ff'];
	var height = options.stripHeight;

	var style = "fill:none;stroke-width:0.1;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none";
	var scorestyle = "stroke:" + colors[0] + ";" + style;
	var cutstyle = "stroke:" + colors[1] + ";" + style;
	var stripstyle = "stroke:" + colors[2] + ";" + style;

	d3.select("#stripSvg").selectAll("svg").remove();
	var stripSvg = d3.select("#stripSvg").append("svg")
		.attr("width", size[0])
		.attr("height", size[1])
		.attr("version", 1.1);

	stripSvg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
	stripSvg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");

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
					stripSvg.append("line")
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
				stripSvg.append("line")
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
			stripSvg.append("line")
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
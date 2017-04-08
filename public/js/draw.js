// line generator
var line = d3.svg.line()
	.x(function(d) { return d.x; })
	.y(function(d) { return d.y; })
	.interpolate("linear");

var drawGroups = function(canvas, inputlist, options) {

	var groups = canvas.selectAll("g.group")
	.data(inputlist)
	.enter().append("g")
	.classed("group", true)
	.each(function(d, i) {
		d.this = this;
	})
	.attr("transform", num.getTransform);

	if (options.groupDraggable) {
		groups.style("cursor", "move")
		.call(dragMove);
	}

	if (options.interiorClickable) {
		groups.style("cursor", "hand")
		.on("click", groupClick);
	}

	if (options.paneZoomable) {
		groups.style("cursor", "move").call(options.bgZoom);
	}

	return groups;
};

var drawTiles = function(groups) {
	return groups.selectAll("g")
	.data(function(d, i) {return d.tiles;})
	.enter().append("g")
	.classed("tile", true)
	.each(function(d, i) {
		d.this = this;
	})
	.attr("transform", num.getTransform);
};

var drawInteriors = function(tiles, options) {
	if (options.displayInterior) {
		var interiors = tiles.append("path")
		.classed("interior", true)
		.classed("infer", function(d) { return d.infer; })
		.attr("d", function(d, i) {
			return line(d.vertices) + "Z";
		});

		if (options.groupDraggable || options.interiorClickable) {
			interiors
			.on('mouseover', function(d) {
				d3.select(this).classed('hover', true);
			})
			.on('mouseout', function(d) {
				if (!hover || (this !== hover.node)) {
					d3.select(this).classed('hover', false);
				}
			});
		}
		return interiors;

	} else {
		return null;
	}
};

var drawPatterns = function(tiles, options) {

	var patterns = tiles.selectAll("path.pattern")
	.data(function(d, i) {
		return d.patterns;
	})
	.enter()
	.insert("path", "line.edge")
	.classed("pattern", true)
	.attr("stroke-linecap", "round")
	.each(function(d, i) {
		d.this = this;
		d.index = i;
	})
	.attr("d", function(d, i) {
		return d.line;
	});

	var datas = _.pluck($(assembleCanvas.node()).find("path.pattern"), "__data__");

	if (options.patternsTraceable) {
		patterns
		.classed("traced", true)
		.on("click", function(d, i) {
			patternClick(this);
		});
	} else {
		patterns
		.style("pointer-events", "none");
	}

	return patterns;
};

var drawEdges = function(tiles, options) {
	var edges = tiles.selectAll("line.edge")
	.data(function(d, i) {
		return d.edges;
	})
	.enter()
	.append("line")
	.classed("edge", true)
	.each(function(d, i) {
		d.this = this;
		d.joinedTo = null;
	})
	.attr({
		x1: function(d) {return d.ends[0][0];},
		y1: function(d) {return d.ends[0][1];},
		x2: function(d) {return d.ends[1][0];},
		y2: function(d) {return d.ends[1][1];}
	});

	if (!options.visibleEdges) {
		edges.attr("visibility", "hidden");
	}

	if (options.clickableEdges) {
		edges.each(function(d, i) {
			d.this = this;
			d.index = i;
			d.handle = drawHandle(d, i, this);
		});
	}

	return edges;
};

var drawHandle = function(edgeData, index, thisEdgeNode) {

	// create invisible edge handles
	var handle = document.createElementNS(assembleSvg.node().namespaceURI, "line");
    thisEdgeNode.parentNode.insertBefore(handle, thisEdgeNode.nextSibling);

    return d3.select(handle)
    .datum(thisEdgeNode)
    .attr({
			x1: function() {return edgeData.ends[0][0];},
			y1: function() {return edgeData.ends[0][1];},
			x2: function() {return edgeData.ends[1][0];},
			y2: function() {return edgeData.ends[1][1];}
	})
	.classed("edgehandle", true)
	.on('mouseover', handleMouseover)
    .on('mouseout', handleMouseout)
    .node();
};

var drawPatternHelpers = function(tiles, options) {
	if (options.draggablePatterns) {
		return tiles.selectAll("g.patternHelper")
		.data(function(d) {
			return d.customTemplate || [];
		})
		.enter()
		.append("g")
		.each(function(d) {
			d.this = this;
		})
		.classed("patternHelper", true)
		.classed("active", function(d, i) {
			return $("#customPatternSelect").val() &&
				i === parseInt($("#customPatternSelect").val()[0], 10);
		});
	} else {
		return null;
	}
};

var drawPatternHelperLines = function (patternHelpers, options) {
	if (options.draggablePatterns) {
		return patternHelpers
		.insert("path", "circle.patternHandle")
		.classed("patternHelperLine", true)
		.attr("d", function(d, i) {
			var tile = this.parentNode.parentNode.__data__;
			var n = tile.edges.length;
			var startEdge = this.parentNode.parentNode.__data__.edges[((d.startEdge % n) + n) % n];
			var startPoint = num.edgeInterpolate(startEdge.ends, d.startProportion);
			var thisTemplate = this.parentNode.__data__;
			thisTemplate.allPoints = [startPoint].concat(_.map(thisTemplate.points, function(i) {
				return num.getTranslation(i.transform);
			}));

			return line(_.map(thisTemplate.allPoints, function(i) {
				return {x: i[0], y: i[1]};
			}));
		});
	} else {
		return null;
	}
};

var drawPatternHandles = function(patternHelpers, options) {
	if (options.draggablePatterns) {
		return patternHelpers.selectAll("circle.patternHandle")
		.data(function(d) {
			return d.points || [];
		})
		.enter()
		.append("circle")
		.classed("patternHandle", true)
		.each(function(d) { d.this = this; })
		.attr("cx", 0)
		.attr("cy", 0)
		.attr("r", 5)
		.attr("transform", num.getTransform)
		.call(dragPatternHandleEdit);
	} else {
		return null;
	}
};

var drawVertices = function(tiles, options) {
	if (options.visibleVertices) {
		var vertices = tiles.selectAll("circle.vertex")
		.data(function(d, i) {
			return d.vertices;
		})
		.enter()
		.append("circle")
		.classed("vertex", true)
		.attr("cx", function(d) {return d.x;})
		.attr("cy", function(d) {return d.y;})
		.attr("r", 5)
		.each(function(d, i) {
			d.this = this;
		});

		if (options.vertexRotate) {
			vertices
			.classed("actionable", true)
			.call(dragRotate);
		}

		return vertices;
	} else {
		return null;
	}
};

var resetAndDraw = function(container, inputlist, options) {
	container.selectAll("g").remove();
	return draw(container, inputlist, options);
};

var draw = function(container, inputlist, options) {

	var groups = drawGroups(container, inputlist, options);
	var tiles = drawTiles(groups);
	var interiors = drawInteriors(tiles, options);
	var edges = drawEdges(tiles, options);
	var vertices = drawVertices(tiles, options);
	var patterns = drawPatterns(tiles, options);
	var patternHelpers = drawPatternHelpers(tiles, options);
	var patternHelperLines = drawPatternHelperLines(patternHelpers, options);
	var patternHandles = drawPatternHandles(patternHelpers, options);

	// used for drawing new element onto canvas directly
	// invoked upon copying elements

	groups.each(function(d, i) {
		_.each(d.joinedEdges, function(pair) {
			var edge1 = d.tiles[pair[0][0]].edges[pair[0][1]];
			var edge2 = d.tiles[pair[1][0]].edges[pair[1][1]];
			var isPlanar = approxEqEdges(transformEdge(edge1.this), transformEdge(edge2.this));
			joinNodes(edge1.this, edge2.this, {isPlanar: isPlanar});
		});
	});

	if (options.autoresizeSidebar && container.style("display") !== "none") {

		var newWidth = 0;
		var scaleFactor = 1;

		if (tiles.length > 0) {
			var boundingBox = container.node().getBBox();

			if (boundingBox.width * 1.3 < config.maxSidebarWidth) {
				newWidth = 1.3 * boundingBox.width;

			} else if (boundingBox.width > config.maxSidebarWidth) {
				newWidth = config.maxSidebarWidth;
				scaleFactor = 0.75 * config.maxSidebarWidth / boundingBox.width;
			} else {
				newWidth = config.maxSidebarWidth;
			}
		} else {
			newWidth = config.initSidebarWidth;
		}

		newWidth += 50;

		assemblePaletteButtons.selectAll("g").remove();

		tiles.each(function(d, i) {
			var verticalOffset = this.parentNode.__data__.transform;
			var fo = assemblePaletteButtons.append("g")
				.each(function(d) {
					d.transform = num.translate(0, num.getTranslation(verticalOffset)[1]);
					d.transform[1][2] = d.transform[1][2] * scaleFactor;
				})
				.attr("transform", num.getTransform)
				.append("foreignObject")
				.attr("height", 50)
				.attr("width", 50);

			var innerBtn = fo
				.append("xhtml:body")
				.attr("xmlns", "http://www.w3.org/1999/xhtml")
				.append("a")
				.classed("btn btn-primary icon-btn", true);

			innerBtn.append("i").classed("fa fa-edit", true);

			innerBtn.on("click", editSpecificPattern(this.parentNode.__data__.tiles));

			var width = innerBtn[0][0].offsetWidth;
			var height = innerBtn[0][0].offsetHeight;

			fo.attr("height", height).attr("width", width)
				.attr("y", - height / 2)
				.attr("x", - width / 2);
		});

		container.each(function(d, i) {
			d.scaledTransform = num.translateBy(
				num.scaleBy(d.origTransform, scaleFactor), 25, 0);
			d.transform = d.scaledTransform;
		}).attr("transform", num.getTransform);

		assemblePaletteButtons[0][0].__data__ = {};

		assemblePaletteButtons.each(function(d, i) {
			d.scaledTransform = num.translate(- (newWidth - 50) / 2 + 10, 0);
			d.transform = d.scaledTransform;
		}).attr("transform", num.getTransform);

		d3.select(container.node().parentNode)
		.each(function(d, i) {
			d.transform = num.translate(newWidth/2, 0);
		})
		.attr("transform", num.getTransform)
		.select("rect")
		.attr("width", newWidth)
		.attr("x", - newWidth / 2);

		d3.selectAll("#assembleSvgToolbar").style("left", (newWidth + 5) + "px");
	}

	return groups;

};

var spaceOut = function(polygons, options) {
	if (options.orientation === "vertical") {
		return _.map(polygons, function(poly, index) {
			if (index > 0) {
				poly.dimensions.cumHeight = polygons[index-1].dimensions.cumHeight + poly.dimensions.height/2 +
					config.sidebarSpacing + polygons[index-1].dimensions.height/2;
			} else {
				poly.dimensions.cumHeight = poly.dimensions.height/2 + config.sidebarSpacing;
			}
			poly.dimensions.cumWidth = 0;
			return poly;
		});
	} else if (options.orientation === "horizontal") {
		return _.map(polygons, function(poly, index) {
			if (index > 0) {
				poly.dimensions.cumWidth = polygons[index-1].dimensions.cumWidth + poly.dimensions.width/2 +
					config.sidebarSpacing + polygons[index-1].dimensions.width/2;
			} else {
				poly.dimensions.cumWidth = poly.dimensions.width/2 + config.sidebarSpacing;
			}
			poly.dimensions.cumHeight = - poly.dimensions.bottom;

			return poly;
		});
	} else {
		console.assert(options.orientation === "neutral", "Orientation must be one of vertical / horizontal / neutral.");
		return _.map(polygons, function(poly, index) {
			poly.dimensions.cumWidth = 0;
			poly.dimensions.cumHeight = 0;
			return poly;
		});
	}
};

var createGroups = function(polygons) {
	return _.map(polygons, function(poly, index) {
		return {tiles: [poly],
			transform: num.translate(0, poly.dimensions.cumHeight)
		};
	});
};

var drawSvgDraggableEdge = function(svg) {
	var edge = svg.append("line")
		.attr("stroke-width", 40)
		.attr("opacity", 0)
		.attr("stroke", "black")
		.style("cursor", "row-resize")
		.attr("x1", 0)
		.attr("x2", config.standardWidth)
		.attr("y1", config.standardHeight)
		.attr("y2", config.standardHeight);

	dragSvgHandler.call(edge);

	return edge;
};

var drawSvgLabel = function(x, y) {
	return function(svg) {
		return svg.append("text")
		.attr("x", x())
		.attr("y", y())
		.attr("text-anchor", "end")
		.text("");
	};
};

var drawSvgDimensionLabel = function(svg) {
	return svg.append("text")
	.attr("x", assembleSvg.node().getBoundingClientRect().width - 20)
	.attr("y", config.standardHeight - 20)
	.attr("text-anchor", "end")
	.text("");
};

var drawSvgInstructionsLabel = function(svg) {
	return svg.append("text")
	.attr("x", config.stripTableWidth + 20)
	.attr("y", 35)
	.attr("text-anchor", "start")
	.attr("font-weight", "bold")
	.attr("font-size", 24)
	.text("");
};

var svgDrawer = function(container, options) {
	return {
		container: container,
		get: function() {
			return _.cloneDeep(this.palettePolygons);
		},
		getTile: function() {
			return container.selectAll("g.tile").datum();
		},
		push: function(p) {
			this.palettePolygons.push(p);
			_.each(this.palettePolygons, function(poly, index) {
				poly.index = index;
			});
		},
		replace: function(p) {
			var index = _.findIndex(assembleSVGDrawer.get(),function(t) {
				return t.polygonID === p.polygonID;
			});
			this.palettePolygons[index] = p;
		},
		pop: function(index) {
			this.palettePolygons.splice(index,1);
		},
		set: function(p) {
			this.palettePolygons = _.cloneDeep(p);
			_.each(this.palettePolygons, function(poly, index) {
				poly.index = index;
			});
		},
		draw: function(furtherOptions) {
			var mergedOptions = _.cloneDeep(options);
			if (furtherOptions) {
				_.merge(mergedOptions, furtherOptions);
			} else {
				mergedOptions = options;
			}
			_.each(this.palettePolygons, function(poly, index) {
				poly.index = index;
			});
			var paletteGroups = createGroups(spaceOut(_.cloneDeep(this.palettePolygons), mergedOptions));
			resetAndDraw(container, paletteGroups, mergedOptions);
		},
		redrawPatterns: function(keepHandles) {
			container.selectAll("path.pattern").remove();
			drawPatterns(container.selectAll("g.tile"), options);

			if (!keepHandles) {
				container.selectAll("g.patternHelper").remove();
				drawPatternHelpers(container.selectAll("g.tile"), options);
				container.selectAll("circle.patternHandle").remove();
				drawPatternHandles(container.selectAll("g.patternHelper"), options);
			}

			container.selectAll("path.patternHelperLine").remove();
			drawPatternHelperLines(container.selectAll("g.patternHelper"), options);
		}
	};
};
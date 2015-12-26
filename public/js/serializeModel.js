
var deepCustomizer = function(includeVertices) {
	return function(val, id, obj) {
		var clone = {};
		if (val === null) {
			return null;
		} else if (_.isElement(val)) {
			// when deepcloning, drop DOM nodes
			return null;
		// if val is a pattern object
		} else if (_.isElement(val.this) && val.this.classList.contains("pattern")) {
			// drop DOM node, copy everything over (shallow clone)
			// except for start and end: decircularize by collapsing reference into an index
			for (var prop in val) {
				if (prop === "end" || prop === "start") {
					clone[prop] = {};
					for (var prop1 in val[prop]) {
						if (prop1 === "edge") {
							clone[prop][prop1] = val[prop][prop1].index;
						} else {
							clone[prop][prop1] = val[prop][prop1];
						}
					}
				} else if (_.isElement(val[prop])) {
					clone[prop] = null;
				} else {
					clone[prop] = val[prop];
				}
			}
			return clone;
		// if val is an edge object
		} else if (_.isElement(val.this) && val.this.classList.contains("edge")) {
			for (var prop in val) {
			// drop DOM node, copy everything over (shallow clone)
			// except for patterns: decircularize by collapsing reference into an index
				if (prop === "patterns") {
					clone[prop] = _.map(val[prop], function(p) {
						return _.cloneDeep(p, function(val, id, obj) {
							if (id === "pattern") {
								return val.index;
							}
						});
					});
				} else if (_.isElement(val[prop])) {
					clone[prop] = null;
				} else {
					clone[prop] = val[prop];
				}
			}
			return clone;
		// if val is a vertex object
		} else if (_.isElement(val.this) && val.this.classList.contains("vertex")) {
			if (includeVertices) {
				// drop DOM node, copy everything over (shallow clone)
				for (var prop in val) {
					if (_.isElement(val[prop])) {
						clone[prop] = null;
					} else {
						clone[prop] = val[prop];
					}
				}
				return clone;
			} else {
				return null;
			}
		}
	};
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


var loadFromJson = function(loaded) {
	if (loaded.version >= minSupportedVersion) {
		d3.select(".loading-overlay").classed("in", true);
		shapeDropdown.node().value = parseInt(loaded.shapeDropdown, 10);
		$("#shapeDropdown").trigger("change");
		shapeDropdownChange();

		var canvasTransform = loaded.canvasTransform;

		assembleCanvas.each(function(d) {
			d.transform = canvasTransform;
		})
		.attr("transform", num.getTransform);
		commonZoomHandler.scale(num.getScale(canvasTransform));
		commonZoomHandler.translate(num.getTranslation(canvasTransform));

		polylist = loaded.polylist;
		var palette = loaded.palette;
		polygonID = _.max(_.pluck(palette, "polygonID")) + 1;

		_.each(polylist, function(group) {
			_.each(group.tiles, circularize);
		});

		if (loaded.shapeOptions) {
			shapeCachedOptions = _.mapValues(loaded.shapeOptions, function(p) {
				_.each(p, circularize);
				return p;
			});
		}
		shapeCachedOptions[shapeDropdown.node().value] = palette;

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

		if (loaded.cropData) {
			setupOverlay();
			$("#cropMode").bootstrapSwitch('state', loaded.cropData.cropMode);

			cropData.vertices = _.map(d3.selectAll(".crop-vertex").filter(function(d) {
				return d.correspondsTo && _.any(loaded.cropData.vertices, function(v) {
					return v.x === d.x && v.y === d.y;
				});
			})[0], function(d) {
				return d.__data__;
			});
			recomputeHull();

			teardownOverlay();
		}
		d3.select(".loading-overlay").classed("in", false);

	} else {
		if (typeof loaded.version === "undefined") {
			loaded.version = "?";
		}
		d3.select(".loading-overlay").classed("in", false);
		throw {
			message: "File was from Wallpaper v" + loaded.version +
				" but only >=v" + minSupportedVersion + " is supported."
		};
	}
};

var saveToFileWithTitle = function(title) {

	var nonCircularPolylist = _.cloneDeep(polylist, deepCustomizer(true, true));

	var nonCircularPalette = _.map(assembleSVGDrawer.get(), function(tile) {
		return reduceCircularity(tile);
	});

	var nonCircularShapeOptions = _.mapValues(shapeCachedOptions, function(p) { return _.map(p, reduceCircularity); });

	var cropVertices = _.map(cropData.vertices, function(v) { return _.pick(v, _.isNumber); });

	var saveFile = {
		polylist: nonCircularPolylist,
		palette: nonCircularPalette,
		shapeOptions: nonCircularShapeOptions,
		cropData: {
			vertices: cropVertices,
			cropMode: $("#cropMode").prop("checked")
		},
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

var getUrlVars = function() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
};

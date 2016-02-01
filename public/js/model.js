var selection = (function() {
	var current = null;
	return {
		get: function() {
			return current;
		},
		index: function() {
			return d3.select(current.groupNode).selectAll("g.tile").datum().index;
		},
		set: function(thisNode, options) {

			options.updatePatternDisplay = (typeof options.updatePatternDisplay !== "undefined") ? options.updatePatternDisplay : true; // true by default

			if (options.type === "edge") {

				d3.select(thisNode)
				.classed("selected", true);

				current = {
					type: options.type,
					edgeNode: thisNode,
					tileNode: thisNode.parentNode,
					groupNode: thisNode.parentNode.parentNode,
					edge: thisNode.__data__,
					polygon: d3.select(thisNode.parentNode).datum(),
				};

			} else if (options.type === "group") {

				d3.select(thisNode).selectAll("path.interior")
				.classed("selected", true);

				d3.select(thisNode).selectAll("circle.vertex, path.pattern, line.edge")
				.classed("selectedGroup", true);

				current = {
					type: options.type,
					groupNode: thisNode,
				};

				copyButton.attr("disabled", null).attr("title", "Copy selection");
				$(copyButton[0]).tooltip("destroy").tooltip({container: 'body'});
				deleteButton.attr("disabled", null).attr("title", "Delete selection");
				$(deleteButton[0]).tooltip("destroy").tooltip({container: 'body'});
			}
		},
		clear: function(type) {

			var activeTab = (d3.select("li.active")[0][0] === null) ? "shape" : d3.select("li.active").attr("id");

			var cssSelector;
			if (!type) {
				cssSelector = "";
			} else if (type === "group") {
				cssSelector = "path";
			} else {
				cssSelector = type;
			}

			d3.selectAll(cssSelector+".hover")
			.classed("hover", false);
			d3.selectAll(cssSelector+".selected")
			.classed("selected", false);

			d3.selectAll("circle.vertex, path.pattern, line.edge")
			.classed("selectedGroup", false);

			copyButton.attr("disabled", "disabled").attr("title", "Select tiles first.");
			$(copyButton[0]).tooltip("destroy").tooltip({container: 'body'});
			deleteButton.attr("disabled", "disabled").attr("title", "Select tiles first.");
			$(deleteButton[0]).tooltip("destroy").tooltip({container: 'body'});
			$("#patternModal").modal('hide');

			if (current && (typeof type === "undefined" || current.type === type)) {
				current = null;
			}
		},
		delete: function(svgDrawer){
			if (svgDrawer) {
				if (current && current.type === "group") {
					svgDrawer.pop(d3.select(current.groupNode).datum().tiles[0].index);
					svgDrawer.draw();
				} else {
					bootbox.alert("You need to select a group of tiles first.");
				}
				selection.clear();
			} else {
				if (current && current.type === "group") {
					polylist.splice(_.findIndex(polylist, function(group) {
						return group.this === current.groupNode;
					}),1);
					d3.select(current.groupNode).remove();
					checkRep();
				} else {
					bootbox.alert("You need to select a group of tiles first.");
				}
				selection.clear();
			}
		},
		copy: function(svgDrawer) {
			if (svgDrawer) {
				if (current && current.type === "group") {
					var newTile = _.cloneDeep(d3.select(current.groupNode).selectAll("g.tile").datum());
					var proxy = polygon([], num.id);
					// use proxy's polygonID to assign newTile a new ID
					newTile.polygonID = proxy.polygonID;
					svgDrawer.push(newTile);
					svgDrawer.draw();
				} else {
					bootbox.alert("You need to select a group of tiles first.");
				}
			} else {
				if (current && current.type === "group") {
					var currentGroup = _.find(polylist, function(group) {
						return group.this === current.groupNode;
					});
					var clone = _.cloneDeep(currentGroup, deepCustomizer(true));
					_.each(clone.tiles, circularize);
					polylist.push(clone);

					var newGroups = draw(assembleCanvas, polylist, assembleCanvasOptions);

					_.map(polylist, function(group) {
						group.this.__data__ = group;
					});

					newGroups.each(function(d, i) {
						var boundingRect = this.getBoundingClientRect();
						var xFactor = 0.2 + 0.1 * Math.random();
						var yFactor = 0.2 + 0.1 * Math.random();
						d.transform = num.translateBy(d.transform, boundingRect.width * xFactor, boundingRect.height * yFactor);
					})
					.attr("transform", num.getTransform);
					checkRep();
				} else {
					bootbox.alert("You need to select a group of tiles first.");
				}
			}
		}
	};
})();

var checkRep = function() {
	if (config.debug) {
		console.assert(assembleCanvas.node().childNodes.length === polylist.length,
			"Error: data rep and DOM length do not match. \nCanvas: %o\npolylist: %o",
			assembleCanvas.node(), polylist);
		_.map(polylist, function(group) {
			console.assert(group.this.__data__ === group,
				"Error: group object is out of sync with DOM pointer. \nGroup: %o",
				group);
			_.map(group.tiles, function(tile) {
				console.assert(tile.this.__data__ === tile,
					"Error: tile object is out of sync with DOM pointer. \nTile: %o",
					tile);
				_.map(tile.edges, function(edge) {
					console.assert(edge.this.__data__ === edge,
					"Error: edge object is out of sync with DOM pointer. \nEdge: %o %o",
					edge, edge.this);
					if (edge.joinedTo) {
						console.assert(edge.joinedTo.node.__data__.joinedTo.node === edge.this,
							"Error, edge linking information is out of sync. \nEdge: %o",
							edge);
					}
				});
				_.map(tile.patterns, function(pattern) {
					console.assert(pattern.this.__data__ === pattern,
						"Error: pattern object is out of sync with DOM pointer. \nPattern: %o",
						pattern);
				});
			});
		});
	}
};
// activate separation of two edges
var breakEdges = function(thisEdgeNode) {

	var otherEdgeNode = thisEdgeNode.__data__.joinedTo;
	var thisTileNode = thisEdgeNode.parentNode;
	var otherTileNode = otherEdgeNode.parentNode;

	var BFSResults = tileBFS(otherTileNode, thisTileNode, [thisEdgeNode, otherEdgeNode]);

	// break enough edges to form 2 connected components
	d3.selectAll(BFSResults.edgesToBreak)
	.classed("joined", false)
	.each(function(d,i) {
		d.joinedTo = null;
	});

	// move seen elements into new g
	var newG = document.createElementNS(assembleSvg.node().namespaceURI, "g");
	assembleCanvas.node().appendChild(newG);
	_.each(BFSResults.seen, function(tile) {
		newG.appendChild(tile);
	});

	d3.select(newG)
	.classed("group", true)
	.datum(function() {
		// update origData and newData correctly
		// to keep polylist in sync
		var origData = thisTileNode.parentNode.__data__;
		var newData = {
			tiles: _.filter(origData.tiles, function(tile) {
				return tile.this.parentNode === newG;
			}),
			this: newG,
			transform: _.cloneDeep(origData.transform)
		};
		origData.tiles = _.filter(origData.tiles, function(tile) {
			return tile.this.parentNode === thisTileNode.parentNode;
		});
		polylist.push(newData);
		return newData;
	})
	.style("cursor", "move")
	.call(dragMove)
	.attr("transform", num.getTransform);

	// graphics to split two edges apart
	var normal = num.vecProd(num.normalVector(transformEdge(thisEdgeNode)),
		config.breakEdgeDist);

	d3.selectAll([newG, thisTileNode.parentNode])
	.each(function(d,i) {
		var dir = i ? 1 : -1;
		d.transform = num.translateBy(d.transform, dir * normal[0], dir * normal[1]);
	})
	.transition()
	.attr("transform", num.getTransform);
}

// used to traverse a group of tiles, figuring out connected components
// used by breakEdges
var tileBFS = function(otherTileNode, thisTileNode, edgesToBreak) {

	var stack = [[otherTileNode, thisTileNode]];
	var seen = [otherTileNode];

	while (stack.length > 0) {
		var next = stack.shift();
		var currentNode = next[0];
		var previousNode = next[1];
		_.map(getSuccessors(currentNode, previousNode), function(nbrObject) {
			if (nbrObject.tile === thisTileNode) {
				edgesToBreak.push(nbrObject.edges[0], nbrObject.edges[1]);
			} else if (!_.contains(seen, nbrObject.tile)) {
				stack.push([nbrObject.tile, currentNode]);
				seen.push(nbrObject.tile);
			}
		});
	}

	return {
		seen: seen,
		edgesToBreak: edgesToBreak
	}
}

// BFS utility function
var getSuccessors = function(thisTileNode, fromTileNode) {
	return _.map(_.filter(d3.select(thisTileNode).selectAll("line.edge")[0],
		function(edgeNode) {
			return edgeNode.__data__.joinedTo;
		}), function(edgeNode) {
			return {
				tile: edgeNode.__data__.joinedTo.parentNode,
				edges: [edgeNode, edgeNode.__data__.joinedTo]
			};
		});
}


// activate joining of two edges
// pass in an edge node and a selected object
var joinEdges1 = function(thisEdgeNode, selected) {
	if (selected === null) {
		alert("Error: cannot join unselected edges!");
	} else if (thisEdgeNode.parentNode.parentNode === selected.groupNode) {
		alert("Error: cannot join edges from same group!");
	} else if (!approxEq(thisEdgeNode.__data__.length, selected.edgeNode.__data__.length)) {
		alert("Error: cannot join edges with different lengths!");
	} else {
		var d = thisEdgeNode.__data__;
		var thisTileNode = thisEdgeNode.parentNode;
		var thisGroupNode = thisTileNode.parentNode;

		centerCoords(thisTileNode);
		centerCoords(selected.tileNode);

		// calculate transformation to destination
		var t = calculateJoin(thisEdgeNode, selected);

		// calculate equivalent transformation under new group
		// to stay in original position
		// used for animation purposes
		var orig = num.dot(
			num.inv(thisGroupNode.__data__.transform),
			selected.groupNode.__data__.transform);

		// first transform to original equivalent transformation
		// transition over time to destination
		var tiles = d3.select(selected.groupNode)
		.selectAll("g.tile")
		.attr("transform", function(d) {
			return num.getTransform({
				transform: num.dot(orig, d.transform)
			});
		})
		.each(function(d) {
			d.transform = num.dot(t, d.transform);
		})
		.transition()
		.attr("transform", num.getTransform);

		var theseEdges = _.cloneDeep(d3.select(thisGroupNode).selectAll("line.edge"));
		var otherEdges = _.cloneDeep(d3.select(selected.groupNode).selectAll("line.edge"));

		// move tiles to new group in the DOM
		_.each(tiles[0], function(tile) {
			thisGroupNode.appendChild(tile);
		});

		// update data to reflect
		thisGroupNode.__data__.tiles.extend(selected.groupNode.__data__.tiles);

		// remove original group from polylist
		polylist.splice(_.findIndex(polylist, function(group) {
			return group.this === selected.groupNode;
		}),1);

		// remove group node from DOM
		d3.select(selected.groupNode).remove();

		detectJoins(theseEdges, otherEdges, false);
	}
}

// detect how edges should be joined
// used during a join or a copy action
var detectJoins = function(group1Edges, group2Edges, reset) {

	// synchronize all edges to a common coordinate system
	if (reset) {
		var allEdges = _.flatten(group1Edges.concat(group2Edges));
		d3.selectAll(allEdges)
		.classed("joined", false)
		.each(function(d, i) {
			d.joinedTo = null;
		});
	}

	// detect via a double loop when two edges are approximately equal
	_.map(transformEdges(group1Edges), function(edge) {
		_.map(transformEdges(group2Edges), function(other) {
			if (edge.node !== other.node && approxEqEdges(edge.ends, other.ends)
				&& !(edge.node.__data__.joinedTo) && !(other.node.__data__.joinedTo)) {
				edge.node.__data__.joinedTo = other.node;
				other.node.__data__.joinedTo = edge.node;
				d3.selectAll([edge.node, other.node])
				.classed("joined", true);
			}
		});
	});
}

var detectSelfJoins = function(group, reset) {
	detectJoins(group, group, reset);
}

// activated upon dragging tile from palette to main canvas
var enterCanvas = function(groupNode) {

	// generate new group element
	assembleCanvas.node().appendChild(groupNode);

	d3.select(groupNode)
	.each(function(d, i) {
		d.transform = translateWithoutScale(d);
	})
	.attr("transform", num.getTransform);

	// activate circle dragger only upon entering canvas
	d3.select(groupNode).selectAll("circle.vertex")
	.call(dragRotate);

	// update polylist
	polylist.push(groupNode.__data__);

	// redraw sidebar
	assembleSVGDrawer.draw();

	// activate infer button if new tile has inferred pattern
	if(groupNode.__data__.tiles[0].infer) {
		inferButton.classed("hidden", false);
	}

	if (((new Date()).getTime() - groupNode.__data__.startTime) < config.clickThreshold) {
		// slide outwards
		d3.select(groupNode)
		.each(function(d) {
			d.transform = num.translateBy(d.transform, config.slidingFactor * assembleSvg.node().getBBox().width, 0);
		})
		.transition()
		.attr("transform", num.getTransform);
	}
}

var joinEdges = function(thisEdgeNode, selected) {
	if (selected === null) {
		alert("Error: cannot join unselected edges!");
	} else if (thisEdgeNode.parentNode.parentNode === selected.groupNode) {
		alert("Error: cannot join edges from same group!");
	} else if (!approxEq(thisEdgeNode.__data__.length, selected.edgeNode.__data__.length)) {
		alert("Error: cannot join edges with different lengths!");
	} else {
		var d = thisEdgeNode.__data__;
		var thisTileNode = thisEdgeNode.parentNode;
		var thisGroupNode = thisTileNode.parentNode;

		centerCoords(thisTileNode);
		centerCoords(selected.tileNode);

		// calculate equivalent transformation under new group
		// to stay in original position
		var orig = num.dot(
			num.inv(thisGroupNode.__data__.transform),
			selected.groupNode.__data__.transform);

		// first transform to original equivalent transformation
		// transition over time to destination
		var tiles = d3.select(selected.groupNode)
		.selectAll("g.tile")
		.each(function(d) {
			d.transform = num.dot(orig, d.transform);
		})
		.attr("transform", num.getTransform);

		var theseEdges = _.cloneDeep(d3.select(thisGroupNode).selectAll("line.edge"));
		var otherEdges = _.cloneDeep(d3.select(selected.groupNode).selectAll("line.edge"));

		// move tiles to new group in the DOM
		_.each(tiles[0], function(tile) {
			thisGroupNode.appendChild(tile);
		});

		// update data to reflect
		thisGroupNode.__data__.tiles.extend(selected.groupNode.__data__.tiles);

		// remove original group from polylist
		polylist.splice(_.findIndex(polylist, function(group) {
			return group.this === selected.groupNode;
		}),1);

		// remove group node from DOM
		d3.select(selected.groupNode).remove();

		// equivalent of detectJoins
		thisEdgeNode.__data__.joinedTo = selected.edgeNode;
		selected.edgeNode.__data__.joinedTo = thisEdgeNode;
		d3.selectAll([thisEdgeNode, selected.edgeNode])
		.classed("joined", true);
	}
}

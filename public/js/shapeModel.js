// compute dimensions relating to a list of vertices
var computeDimensions = function(vertices, transform) {
	var transformedCoords = _.map(vertices, function(v) {
		return num.dot(transform, [v.x, v.y, 1]);
	});

	var transformedXValues = _.pluck(transformedCoords, "0");
	var transformedYValues = _.pluck(transformedCoords, "1");

	var top = Math.roundToPrecision(transformedYValues.min(), config.globalPrecisionCap);
	var bottom = Math.roundToPrecision(transformedYValues.max(), config.globalPrecisionCap);
	var right = Math.roundToPrecision(transformedXValues.max(), config.globalPrecisionCap);
	var left = Math.roundToPrecision(transformedXValues.min(), config.globalPrecisionCap);

	return {
		top: top,
		bottom: bottom,
		left: left,
		right: right,
		width: right - left,
		height: bottom - top
	};
};

// update dimensions for a tile
// based on the tile's list of vertices
var updateDimensions = function(tile) {
	tile.transform = num.dot(tile.origTransform, recenterAndRoundVertices(tile.vertices));
	tile.dimensions = computeDimensions(tile.vertices, tile.transform);
};


// update a given vertex label for a custom shape
var updateVertexLabel = function(vertexLabel) {
	return vertexLabel.attr({
			x: function(d) {return d.__data__.x + config.labelOffset;},
			y: function(d) {return d.__data__.y + config.labelOffset;},
	})
	.text(function(d) {
		return (d.__data__.angle / Math.PI * 180).toFixed(1) + "°";
	});
};

// update a given edge label for a custom shape
var updateEdgeLabel = function(edgeLabel) {
	return edgeLabel
	.each(function(d, i) {
		d.coords = num.vecSum(num.edgeCenter(d.__data__.ends), config.labelOffset);
	})
	.attr({
		x: function(d) { return d.coords[0]; },
		y: function(d) { return d.coords[1]; }
	})
	.text(function(d) {
		return (d.__data__.length / config.sidelength).toFixed(2);
	});
};

var recenterAndRoundVertices = function(vertices) {
	// translate vertices
	var tileCenter = _.map(_.reduce(vertices, function(center, v) {
		center[0] += v.x;
		center[1] += v.y;
		return center;
	}, [0,0]), function(coord) {
		return coord / vertices.length;
	});

	_.map(vertices, function(v) {
		v.x -= tileCenter[0];
		v.y -= tileCenter[1];
		v.angle = Math.roundToPrecision(v.angle, config.globalPrecisionCap);
		v.x = Math.roundToPrecision(v.x, config.globalPrecisionCap);
		v.y = Math.roundToPrecision(v.y, config.globalPrecisionCap);
	});
};

// called when custom shape is being dragged
var updateVertexAndEdgeEnds = function(vertexData, i) {
	var thisVertexNode = vertexData.this;

	// update own coordinates
	vertexData.x = d3.event.x;
	vertexData.y = d3.event.y;

	d3.select(thisVertexNode)
	.attr("cx", function(d) {return d.x; })
	.attr("cy", function(d) {return d.y; });

	var thisTileNode = thisVertexNode.parentNode;
	var thisTile = thisTileNode.__data__;
	var edges = thisTile.edges;
	var vertices = thisTile.vertices;

	var n = edges.length;

	// update neighboring edges
	var nextEdge = edges[i];
	nextEdge.ends[0] = [vertexData.x, vertexData.y];

	var prevEdge = edges[(i+n-1) % n];
	prevEdge.ends[1] = [vertexData.x, vertexData.y];

	d3.selectAll([nextEdge.this, prevEdge.this])
	.attr({
		x1: function(d) {return d.ends[0][0];},
		y1: function(d) {return d.ends[0][1];},
		x2: function(d) {return d.ends[1][0];},
		y2: function(d) {return d.ends[1][1];}
	})
	.each(function(d, i) {
		d.length = num.edgeLength(d.ends);
	});

	// update neighboring angles
	var previousVertexNode = vertices[(i+n-1) % n].this;
	var nextVertexNode = vertices[(i+n+1) % n].this;

	d3.selectAll([previousVertexNode, thisVertexNode, nextVertexNode])
	.each(function(d, j) {

		var index = i + j - 1;

		var nextEdge = edges[(index + n) % n];
		var prevEdge = edges[(index + n - 1) % n];

		var nextVector = num.vectorFromEnds(nextEdge.ends);
		var prevVector = num.vectorFromEnds(prevEdge.ends);

		d.angle = Math.PI - num.angleBetweenVectors(nextVector, prevVector);
	});

	// update labels
	d3.select(thisTileNode).selectAll("text.vertexlabel")
	.call(updateVertexLabel);

	d3.select(thisTileNode).selectAll("text.edgelabel")
	.call(updateEdgeLabel);

	// redraw interior
	d3.select(thisTileNode).selectAll("path.interior")
	.attr("d", function(d, i) {
		return line(d.vertices) + "Z";
	});
};

// add new polygon to palette
var pushPolygonToLineup = function(tile) {
		assembleSVGDrawer.push(tile);
		assembleSVGDrawer.draw();
};

// add new manual polygon to palette
var pushManualPolygonToLineup = function(inputSidelengths, inputAngles) {
	var validateArray = function(check) {
		return function(inputStr) {
			var arr = JSON.parse(inputStr);
			if (!(arr instanceof Array)) {
				throw new Error("Submission must be array.");
			} else if (arr.length < 3) {
				throw new Error("Array length must be greater than or equal to 3.");
			}
			arr = _.map(arr, check);
			return arr;
		};
	};

	var validateAngles = validateArray(function(i) {
		if (typeof(i) !== "number" || !isFinite(i)) throw new Error("Angle must be numeric.");
		if ((i <= 0) || (i >= 360)) throw new Error("Angle must be between 0 and 360 deg.");
		return i / 180 * Math.PI;
	});

	var validateLengths = validateArray(function(i) {
		if (typeof(i) !== "number" || !isFinite(i)) throw new Error("Sidelength must be numeric.");
		if (i <= 0) throw new Error("Length must be strictly positive.");
		return i;
	});

	try {
		var sidelengths, angles;
		if (inputSidelengths === "" && inputAngles === "") {
			throw new Error("Input cannot be blank.");
		} else if (inputSidelengths === "" ) {
			angles = validateAngles(inputAngles);
			sidelengths = _.map(angles, function() { return 1; });
		} else if (inputAngles === "" ) {
			sidelengths = validateLengths(inputSidelengths);
			angles = _.map(sidelengths, function() { return Math.PI * (sidelengths.length - 2) / sidelengths.length; });
		} else {
			angles = validateAngles(inputAngles);
			sidelengths = validateLengths(inputSidelengths);
			if (sidelengths.length !== angles.length) {
				throw new Error("Array lengths must be the same.");
			}
		}
		var n = angles.length;
		if (!approxEq(angles.sum(), (n - 2) * Math.PI, config.anglesTolerance)) {
			throw new Error("Angles must sum to (n-2) * 180 deg.");
		}
		assembleSVGDrawer.push(polygonFromAnglesAndLengths(angles, sidelengths, 0));
		assembleSVGDrawer.draw();
	} catch (e) {
		bootbox.alert("Error: " + e.message);
	}
};

// create regular polygon
var regularPolygon = function(n, sidelength) {
	sidelength = sidelength ? sidelength : 1;
	var vertexR = sidelength * Math.sin(Math.PI * (1/2 - 1/n)) / Math.sin(2 * Math.PI / n);
	var angleOffset = Math.PI * (1/2 - 1/n);
	var vertexData = _.map(_.range(n), function(i) {
		var theta = 2 * i * Math.PI / n + angleOffset;
		return {
			angle: (n - 2) * Math.PI / n,
			coords: [Math.cos(theta) * vertexR, Math.sin(theta) * vertexR]
		};
	});

	var transform = num.id;

	return polygon(vertexData, transform);
};

// syntactic sugar for list of regular polygons
var regularPolygonList = function(nArray) {
	return _.map(nArray, function(n) {
		return regularPolygon(n);
	});
};

// create a polygon from a list of angles (assume equilateral)
var polygonFromAngles = function(angles, theta, sidelength) {
	sidelength = sidelength ? sidelength : 1;
	console.assert(sidelength > 0,
		"Error: polygon must have strictly positive side length.\n%o", sidelength);

	return polygonFromAnglesAndLengths(angles, _.map(
		_.range(angles.length), function() { return sidelength; }), theta);
};

// create a polygon from a list of angles and sidelengths
var polygonFromAnglesAndLengths = function(angles, lengths, theta) {
	theta = theta ? theta : 0;
	console.assert(approxEq(angles.sum(), (angles.length - 2) * Math.PI, config.angleTolerance),
		"Error: polygon interior angles do not sum up to (n-2)pi.\n%o", angles);
	console.assert(angles.length >= 3,
		"Error: polygon must have 3 or more interior angles.\n%o", angles);
	console.assert(_.every(angles, function(angle) { return angle > 0; } ),
		"Error: polygon must have strictly positive interior angles.\n%o", angles);
	console.assert(_.every(lengths, function(length) { return length > 0; } ),
		"Error: polygon must have strictly positive side lengths.\n%o", lengths);
	console.assert(angles.length === lengths.length,
		"Error: polygon must have equal number of angles and sides");

	var lastAngle = 0;
	var lastVertex = [0,0];

	var vertexData = [{
		angle: _.last(angles),
		coords: lastVertex
	}];

	var lengthQueue = _.cloneDeep(lengths);

	_.map(angles, function(angle) {
		var length = lengthQueue.shift();
		var nextVertex = [lastVertex[0] + length * Math.cos(lastAngle), lastVertex[1] + length * Math.sin(lastAngle)];
		vertexData.push({
			angle: angle,
			coords: nextVertex
		});

		lastVertex = nextVertex;
		lastAngle += Math.PI - angle;
	});

	// if polygon closes up, delete final vertex
	// else, treat array of n lengths and angles as specifying polygon of (n+1) sides
	if (approxEqPoints(_.first(vertexData).coords, _.last(vertexData).coords, config.polygonTolerance)) {
		vertexData.pop();
	}

	var transform = theta ? num.rotate(theta) : num.id;

	return polygon(vertexData, transform);
};

var polygonID = 0;

// create polygon from list of vertices
var polygon = function(vertexData, origTransform, raw) {
	var factor = raw ? 1 : config.sidelength;

	var vertices = _.map(vertexData, function(v) {
		return {
			angle: v.angle,
			x: v.coords[0] * factor,
			y: v.coords[1] * factor
		};
	});

	vertices.get = function(i) {
		return this[i % this.length];
	};

	recenterAndRoundVertices(vertices);

	var transform = num.dot(origTransform, num.id);

	var edges = _.map(vertices, function(value, index, collection) {
		var ends = [[collection.get(index).x, collection.get(index).y],
			[collection.get(index+1).x, collection.get(index+1).y]];
		return {
			index: index,
			ends: ends,
			patterns: [],
			length: Math.roundToPrecision(num.edgeLength(ends),config.globalPrecisionCap),
			joinedTo: null};
	});

	return {
		// ensures polygonID is unique
		polygonID: polygonID++,
		infer: false,
		dimensions: computeDimensions(vertices, transform),
		vertices: vertices,
		edges: edges,
		patterns: [],
		transform: transform,
		origTransform: origTransform
	};
};

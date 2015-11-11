// generate patterns for a given polygon
var polygonAddPattern = function(polygon, makePatterns) {
	polygon.patterns = makePatterns(polygon.edges);
	d3.select(polygon.this).select("path.interior")
	.classed("infer", polygon.infer);
};

// add metadata for a given pattern after it has been created
var polygonAddPatternMetadata = function(polygon) {

	_.map(polygon.edges, function(edge) {
		edge.patterns = _.chain(polygon.patterns)
			.filter(function(p) {
				return (p.start.edge === edge || p.end.edge === edge);
			}).map(function(p) {
				if (p.start.edge === edge) {
					return {
						pattern: p,
						proportion: p.start.proportion,
						angle: p.start.angle,
						atStart: true
					};
				} else {
					return {
						pattern: p,
						proportion: p.end.proportion,
						angle: p.end.angle,
						atStart: false
					};
				}
			}).sortBy("angle").sortBy("proportion").value();

		if (edge.patternInterface) {
			// if a pattern interface exists (i.e. a record of angles and proportions before cropping)
			// use that to annotate intersect data
			_.map(edge.patternInterface, function(pInt, i) {
				var p = _.find(edge.patterns, function(p) {
					return approxEq(p.angle, pInt.angle, config.anglesTolerance)
					&& approxEq(p.proportion, pInt.proportion, config.proportionTolerance);
				});
				if (p) {
					// annotate p's intersect information only if p exists
					if (i > 0 && approxEq(pInt.proportion, edge.patternInterface[i-1].proportion, config.proportionTolerance)) {
						p.intersect = true;
						if (p.atStart) {
							p.pattern.start.intersect = true;
						} else {
							p.pattern.end.intersect = true;
						}
					} else if (i < (edge.patternInterface.length - 1) && approxEq(pInt.proportion, edge.patternInterface[i+1].proportion, config.proportionTolerance)) {
						p.intersect = true;
						if (p.atStart) {
							p.pattern.start.intersect = true;
						} else {
							p.pattern.end.intersect = true;
						}
					} else {
						p.intersect = false;
						if (p.atStart) {
							p.pattern.start.intersect = false;
						} else {
							p.pattern.end.intersect = false;
						}
					}
				}
			});
		} else {
			_.map(edge.patterns, function(p, i) {
				if (i > 0 && approxEq(p.proportion, edge.patterns[i-1].proportion, config.proportionTolerance)) {
					p.intersect = true;
					if (p.atStart) {
						p.pattern.start.intersect = true;
					} else {
						p.pattern.end.intersect = true;
					}
				} else if (i < (edge.patterns.length - 1) && approxEq(p.proportion, edge.patterns[i+1].proportion, config.proportionTolerance)) {
					p.intersect = true;
					if (p.atStart) {
						p.pattern.start.intersect = true;
					} else {
						p.pattern.end.intersect = true;
					}
				} else {
					p.intersect = false;
					if (p.atStart) {
						p.pattern.start.intersect = false;
					} else {
						p.pattern.end.intersect = false;
					}
				}
			});
		}

	});

	buildIntersections(polygon);
};

// compute intersections for each pattern within a polygon
var buildIntersections = function(polygon) {
	var patterns = polygon.patterns;

	var intersectionPatterns = _.map(patterns, function(p) {
		return new Pattern(p);
	});

	var intersectionMap = [];

	_.map(intersectionPatterns, function(p_i, i) {
		intersectionMap[i] = [];
		_.map(intersectionPatterns, function(p_j, j) {
			intersectionMap[i][j] = Intersection.intersectShapes(p_i, p_j);
		});
	});

	var collated = _.map(intersectionMap, function(arr, i) {
		var accumulated = _.reduce(arr, function(accumulated, intersectionObject) {
			return _.map(accumulated, function(cell, j) {
				return accumulated[j].concat(intersectionObject.points[j]);
			});
		}, _.map(_.range(patterns[i].internalVertices.length + 1), function() { return []; }));
		var arrOfSegments = _.map(accumulated, function(a, j) {
			return [{relative: 0, coords: patterns[i].allVertices[j], intersect: false }].concat(_.sortBy(a, "relative"))
			.concat([{relative: 1, coords: patterns[i].allVertices[j+1], intersect: false }]);
		});
		if (patterns[i].start.intersect) {
			arrOfSegments[0][0].intersect = true;
		}
		if (patterns[i].end.intersect) {
			arrOfSegments[arrOfSegments.length - 1][arrOfSegments[arrOfSegments.length - 1].length - 1].intersect = true;
		}
		return arrOfSegments;
	});

	_.map(patterns, function(p, i) {
		intersectedVerticesWithDups = _.flatten(_.map(collated[i], function(segment, j) {
			var list = _.map(segment, function(s) { return {intersect: s.intersect, coords: s.coords}; });
			if (j < collated[i].length - 1) {
				// truncate by 1
				return _.initial(list);
			} else {
				return list;
			}
		}), true);

		p.intersectedVertices = _.filter(intersectedVerticesWithDups, function(vertex, i) {
			return i === 0 || !approxEqPoints(vertex.coords, intersectedVerticesWithDups[i-1].coords);
		});

		p.intersectedSegments = _.map(p.fullSegments, function(s, j) {
			return _.map(_.range(collated[i][j].length - 1), function(k) {
				return (collated[i][j][k+1].relative - collated[i][j][k].relative) * s;
			});
		});
	});
};

// helper function for generating regular motifs like stars
var regularPolygonPattern = function(n, depth, template) {
	var p = 0.5;
	return _.map(_.range(n), function(i) {
		return {
			start: {
				index: i,
				proportion: p
			},
			end: {
				index: i + depth,
				proportion: p
			},
			template: template,
			isSymmetric: true,
			isCropped: true
		};
	});
};

// general function taking in any list of arbitrary patterns
var makePatterns = function(patterns) {
	return function(edges) {
		return _.map(patterns, function(p) {

			p.start.edge = edges[p.start.index % edges.length];
			p.end.edge = edges[p.end.index % edges.length];

			p.start.coords = num.edgeInterpolate(p.start.edge.ends, p.start.proportion);
			p.end.coords = num.edgeInterpolate(p.end.edge.ends, p.end.proportion);

			var transform = function(referenceEdge, referencePoint, flip) {
				var norm = num.normalVector(referenceEdge.ends);
				var theta = - Math.PI/2 + num.getAngle(norm[0], norm[1]);

				return function(coords) {
					var extendedCoords = [coords[0], coords[1], 1];
					if (flip) {
						extendedCoords = num.flipX(extendedCoords);
					}
					var transformedCoords = num.translateBy(num.rotateBy(extendedCoords, -theta), referencePoint[0], referencePoint[1]);
					return [transformedCoords[0], transformedCoords[1]];
				};
			};

			p.internalVertices = [];

			var fromStart = p.isAbsolute ? p.template : _.map(_.map(p.template, function(point) {
				return num.vecProd(point, p.start.edge.length);
			}), transform(p.start.edge, p.start.coords, false));


			if (p.isSymmetric) {

				var fromEnd = _.map(_.map(p.template, function(point) {
					return num.vecProd(point, p.start.edge.length);
				}), transform(p.end.edge, p.end.coords, true));

				// find intersection point between the two terminating line segments
				if (p.isCropped && p.template.length > 0) {
					var startInterpolate = _.takeRight([p.start.coords].concat(fromStart),2);
					var endInterpolate = _.takeRight([p.end.coords].concat(fromEnd),2);

					var matrix1 = [[1, startInterpolate[0][0], startInterpolate[0][1]],
									[1, startInterpolate[1][0], startInterpolate[1][1]],
									[1, endInterpolate[0][0], endInterpolate[0][1]]];

					var matrix2 = [[1, startInterpolate[0][0], startInterpolate[0][1]],
									[1, endInterpolate[1][0], endInterpolate[1][1]],
									[1, endInterpolate[0][0], endInterpolate[0][1]]];

					if (approxEq(num.det(matrix1), 0, num.matrixDetTolerance) && approxEq(num.det(matrix2), 0, num.matrixDetTolerance)) {
						// numerically unstable; line segments to crop are actually collinear
						p.internalVertices = _.initial(fromStart, 1).concat(_.rest(fromEnd.reverse(), 1));
					} else {
						var eqnMatrix = [[startInterpolate[1][0] - startInterpolate[0][0], endInterpolate[0][0] - endInterpolate[1][0]],
										[startInterpolate[1][1] - startInterpolate[0][1], endInterpolate[0][1] - endInterpolate[1][1]]];

						var ans = num.dot(num.inv(eqnMatrix), [[endInterpolate[0][0] - startInterpolate[0][0]],[endInterpolate[0][1] - startInterpolate[0][1]]]);

						var k = ans[0][0];

						console.assert(Number.isFinite(k), "Unable to automatically deduce symmetric configuration for polygon.\n", p, edges);

						var centerPoint = [startInterpolate[0][0] + k * (startInterpolate[1][0] - startInterpolate[0][0]),
							startInterpolate[0][1] + k * (startInterpolate[1][1] - startInterpolate[0][1])];

						p.internalVertices = _.initial(fromStart).concat([centerPoint].concat(_.rest(fromEnd.reverse())));
					}
				} else {
					p.internalVertices = fromStart.concat(fromEnd.reverse());
				}

			} else {
				p.internalVertices = fromStart;
			}

			computePatternDataFromInternalVertices(p);

			return p;
		});
	};
};

var computePatternDataFromInternalVertices = function(p) {

	p.allVertices = [p.start.coords].concat(p.internalVertices).concat([p.end.coords]);

	p.fullSegments = _.map(_.range(p.allVertices.length-1), function(i) {
		return num.edgeLength([p.allVertices[i],p.allVertices[i+1]]);
	});

	// calculate angles with edges

	var secondPoint = p.allVertices[1];
	var startVector = num.vecSub(secondPoint, p.start.coords);
	var startEdgeVector = num.vectorFromEnds(p.start.edge.ends);
	p.start.angle = num.angleBetweenVectors(startVector, startEdgeVector);

	var secondToLastPoint = p.allVertices[p.allVertices.length - 2];
	var endVector = num.vecSub(secondToLastPoint, p.end.coords);
	var endEdgeVector = num.vectorFromEnds(p.end.edge.ends);
	p.end.angle = num.angleBetweenVectors(endVector, endEdgeVector);

	// calculate line generator
	p.line = "M" + p.start.coords[0] + "," + p.start.coords[1] +
		_.map(p.internalVertices, function(point) {
			return "L" + point[0] + "," + point[1];
		}).join("") +
		"L" + p.end.coords[0] + "," + p.end.coords[1];

};

var generatePatternInterface = function(tile) {
	_.each(tile.edges, function(edge) {
		edge.patternInterface = _.map(edge.patterns, function(p) {
			return {
				angle: p.angle,
				proportion: p.proportion
			};
		});
	});
};

// Hankin inference algorithm to match up list of rays
var greedyInference = function(rays) {
	var allPairs = [];

	_.map(rays, function(ray1) {
		_.map(rays, function(ray2) {
			if (ray1 !== ray2 && ray1.index !== ray2.index) {
				var a1 = ray1.ends[0], a2 = ray1.ends[1], b1 = ray2.ends[0], b2 = ray2.ends[1];

				var ua_t=(b2[0]-b1[0])*(a1[1]-b1[1])-(b2[1]-b1[1])*(a1[0]-b1[0]);
				var ub_t=(a2[0]-a1[0])*(a1[1]-b1[1])-(a2[1]-a1[1])*(a1[0]-b1[0]);
				var u_b=(b2[1]-b1[1])*(a2[0]-a1[0])-(b2[0]-b1[0])*(a2[1]-a1[1]);

				if(u_b!==0){
					var ua=ua_t/u_b;
					var ub=ub_t/u_b;

					if (ua > 0 && ub > 0) {
						var angle = num.angleBetweenEnds(ray1.ends, ray2.ends);
						allPairs.push({
							angle: parseFloat((angle).toFixed(1)),
							rays: [ray1, ray2],
							distance: parseFloat((ua + ub).toFixed(0)),
							template: [num.vecSum(ray1.ends[0], num.vecProd(ray1.vector, ua))]
						});
					}
				}
			}
		});
	});

	var allSortedPairs = _.sortBy(_.sortBy(_.filter(allPairs, function(p) {
		return isFinite(p.angle) && isFinite(p.distance);
	}), "angle").reverse(), "distance");

	var greedy = [];

	while (allSortedPairs.length > 0) {
		var nextPair = _.first(allSortedPairs);
		allSortedPairs = _.reject(allSortedPairs, function(pair) {
			return _.contains(pair.rays, nextPair.rays[0]) || _.contains(pair.rays, nextPair.rays[1]);
		});
		greedy.push(nextPair);
	}

	if (greedy.length !== rays.length / 2) {
		console.error("Hankin inference incomplete.");
	}

	return greedy;
};

// helper function for generating rotated rays for Hankin inference algorithm
var rotatedRay = function(angle, offset) {
	return function(edge, index) {
		var normal = num.normalize(num.normalVector(edge.ends));
		normal.push(1);
		var vector = num.rotateBy(normal, angle);
		vector.pop();
		var start = num.edgeInterpolate(edge.ends, offset);
		return {
			ends: [start, num.vecSum(start, vector)],
			vector: vector,
			index: index,
			angle: angle,
			offset: offset
		};
	};
};

// specification for the different pattern options
var patternOptions = [
	{
		name: "Star",
		parameters: [{
			name: "Angle",
			options: function(n) {
				return {
					value: 90 - 180 / (2 * n),
					min: 180 / n,
					max: 90,
					step: 0.1,
					formatter: function(value) {
						return 'Current value: ' + value + '°';
					}
				};
			}
		},{
			name: "Depth",
			options: function(n) {
				return {
					value: n > 4 ? 2 : 1,
					min: 1,
					max: Math.floor(n/2),
					step: 1,
					formatter: function(value) {
						return 'Current value: ' + value;
					}
				};
			}
		}],
		generator: function(tile, angle, depth) {
			tile.infer = false;
			delete tile.customTemplate;
			var n = tile.vertices.length;
			var r = 1 / (2 * Math.tan(Math.PI / n));
			var theta = (2 * angle - 90 ) / 180 * Math.PI;
			var template = [num.vecSum([0, r], num.polarToRect(r, theta))];
			return regularPolygonPattern(n, depth, template);
		}
	},{
		name: "Rosette",
		parameters: [{
			name: "Angle",
			options: function(n) {
				return {
					value: 180 / n,
					min: 0,
					max: 90,
					step: 0.01,
					formatter: function(value) {
						return 'Current value: ' + value + '°';
					}
				};
			}
		},{
			name: "Depth",
			options: function(n) {
				return {
					value: 2,
					min: 1,
					max: Math.floor(n/2),
					step: 1,
					formatter: function(value) {
						return 'Current value: ' + value;
					}
				};
			}
		}],
		generator: function(tile, angle, depth) {
			tile.infer = false;
			delete tile.customTemplate;
			var n = tile.vertices.length;
			var theta = angle / 180 * Math.PI;
			var rho = Math.PI / 2 - Math.PI * (n-2) / (4*n);
			var x = 1/2 * Math.sin(Math.PI * (n-2) / (4*n)) / Math.sin(Math.PI - Math.PI * (n-2) / (4*n) - theta);
			var y = 1/2 * Math.sin(Math.PI * (n-2) / (2*n)) / Math.sin(Math.PI / 2 - Math.PI * (n-2) / (4*n));
			template = [num.polarToRect(x, theta), num.polarToRect(y, rho)];
			return regularPolygonPattern(n, depth, template);
		}
	},
	{
		name: "Extended Rosette",
		parameters: [{
			name: "Angle",
			options: function(n) {
				return {
					value: 360 / n,
					min: 180 / n,
					max: 90,
					step: 0.01,
					formatter: function(value) {
						return 'Current value: ' + value + '°';
					}
				};
			}
		},{
			name: "Depth",
			options: function(n) {
				return {
					value: 3,
					min: 2,
					max: Math.floor(n/2)+1,
					step: 1,
					formatter: function(value) {
						return 'Current value: ' + value;
					}
				};
			}
		}],
		generator: function(tile, angle, depth) {
			tile.infer = false;
			delete tile.customTemplate;
			var n = tile.vertices.length;
			var theta = angle / 180 * Math.PI - Math.PI / n;
			var translation = 1/2 * Math.sin(Math.PI * (n-2) / (2*n)) / Math.sin(Math.PI/2 - theta);
			var refPoint = num.polarToRect(translation, (Math.PI/n + theta));

			var rho = Math.PI / 2 - Math.PI * (n-2) / (4*n);
			var x = 1/2 * Math.sin(Math.PI * (n-2) / (4*n)) / Math.sin(Math.PI - Math.PI * (n-2) / (4*n) - theta);
			var y = 1/2 * Math.sin(Math.PI * (n-2) / (2*n)) / Math.sin(Math.PI / 2 - Math.PI * (n-2) / (4*n));

			var ratio = x * Math.sin(Math.PI * (n-2) / (2*n)) /  Math.sin(Math.PI/2 + Math.PI/n) * 2;

			template = [num.vecSum(refPoint, num.polarToRect(x * ratio, theta + Math.PI / n)),
			num.vecSum(refPoint, num.polarToRect(y * ratio, rho + Math.PI / n))];
			return regularPolygonPattern(n, depth, template);
		}
	},
	{
		name: "Hankin",
		parameters: [{
			name: "Angle",
			options: function(n) {
				return {
					value: 45,
					min: 0,
					max: 90,
					step: 0.1,
					formatter: function(value) {
						return 'Current value: ' + value + '°';
					}
				};
			}
		},{
			name: "Offset",
			options: function(n) {
				return {
					value: 0,
					min: -0.5,
					max: 0.5,
					step: 0.01,
					formatter: function(value) {
						return 'Current value: ' + value;
					}
				};
			}
		}],
		generator: function(tile, angle, offset) {
			tile.infer = false;
			delete tile.customTemplate;
			angle = (90 - angle) / 180 * Math.PI;
			var proportion = 0.5 + offset;

			var clockwiseRays = _.map(tile.edges, rotatedRay(angle, 1-proportion));
			var counterclockwiseRays = _.map(tile.edges, rotatedRay(-angle, proportion));
			var allRays = clockwiseRays.concat(counterclockwiseRays);

			var greedy = greedyInference(allRays);

			var result = _.map(greedy, function(pair) {
				return {
					start: {
						index: pair.rays[0].index,
						proportion: pair.rays[0].offset
					},
					end: {
						index: pair.rays[1].index,
						proportion: pair.rays[1].offset
					},
					template: pair.template,
					isSymmetric: false,
					isCropped: false,
					isAbsolute: true
				};
			});

			return result;
		}
	},
	{
		name: "Infer",
		parameters: [],
		generator: function(tile) {
			tile.infer = true;
			delete tile.customTemplate;
			return [];
		}
	},
	{
		name: "Custom",
		parameters: [],
		generator: function(tile) {
			tile.infer = false;

			var n = tile.vertices.length;

			// read all the input from the form
			var patternInterval = parseInt($("#patternInterval").val(), 10);
			var patternStart = parseInt($("#patternStart").val(), 10);
			var patternDepth = parseInt($("#patternDepth").val(), 10);
			var startProportion = startOffset.getValue() + 0.5;
			var endProportion = endOffset.getValue() + 0.5;
			var degrees = degreesOfFreedom.getValue();
			var isSymmetric = true, isCropped = true;

			var edgesSpec = $('form input[name=edgeRadios][type=radio]:checked').val();
			var symmetrySpec = $('form input[name=symmetryRadios][type=radio]:checked').val();

			if (symmetrySpec === "mirrorNoCrop") {
				isCropped = false;
			} else if (symmetrySpec === "noMirror") {
				isCropped = false;
				isSymmetric = false;
			}

			var applicableEdges = [];

			// parse input to compute applicable Edges
			try {
				if (edgesSpec === "auto") {

					if (!(isFinite(patternInterval) && isFinite(patternStart) && isFinite(patternDepth))) {
						throw new Error("Edge parameters must be numeric.");
					}

					if (!((patternInterval > 0) && (patternStart >= 0) && (patternDepth > 0))) {
						throw new Error("Edge parameters must be non-negative.");
					}

					applicableEdges = _.map(
						_.filter(_.range(n), function(i) {
							return (i-patternStart) % patternInterval === 0 && i >= patternStart;
						}), function(i) {
							return [i, i + patternDepth];
						});

				} else {
					console.assert(edgesSpec === "manual");
					manualEdges = JSON.parse($("#manualEdges").val());

					if (!(manualEdges instanceof Array)) {
						throw new Error("Input must be an array.");
					}

					_.each(manualEdges, function(e) {
						if (!(e instanceof Array) || !(e.length === 2 || e.length === 3)) {
							throw new Error("Each element must be a two element array.");
						}
						if (!Number.isInteger(e[0]) || !Number.isInteger(e[1])) {
							throw new Error("Edge numbers must be valid integers.");
						}

						e[2] = !!(e[2]); // cast to Boolean; used to signify if edges are flipped
					});

					applicableEdges = manualEdges;
					patternStart = applicableEdges[0][0];
				}
			} catch(e) {
				console.error("Error: " + e.message);
				patternStart = 0;
			} finally {

				if (!tile.customTemplate) {
					// default settings

					tile.customTemplate = [{
						startEdge: patternStart,
						endEdge: patternStart + patternDepth,
						patternDepth: patternDepth,
						patternInterval: patternInterval,
						startProportion: startProportion,
						endProportion: endProportion,
						isSymmetric: isSymmetric,
						isCropped: isCropped,
						symmetrySpec: symmetrySpec,
						edgesSpec: edgesSpec,
						applicableEdges: applicableEdges,
						points: _.map(_.range(degrees), function(t) {
							return {transform: num.translate([-10,10])};
						})
					}];
				} else {
					// update parameters for each selected pattern
					_.map($("#customPatternSelect").val(), function(i) {
						i = parseInt(i, 10);
						var selectedTemplate = tile.customTemplate[i];
						selectedTemplate.startEdge = patternStart;
						selectedTemplate.endEdge = patternStart + patternDepth;
						selectedTemplate.patternDepth = patternDepth;
						selectedTemplate.patternInterval = patternInterval;
						selectedTemplate.startProportion = startProportion;
						selectedTemplate.endProportion = endProportion;
						selectedTemplate.isSymmetric = isSymmetric;
						selectedTemplate.isCropped = isCropped;
						selectedTemplate.symmetrySpec = symmetrySpec;
						selectedTemplate.edgesSpec = edgesSpec;
						selectedTemplate.applicableEdges = applicableEdges;

						if (selectedTemplate.points.length > degrees) {
							selectedTemplate.points = _.take(selectedTemplate.points, degrees);
						}

						var toPush = selectedTemplate.points.length > 0 ? _.last(selectedTemplate.points) : {transform: num.translate(0,0)};
						while (selectedTemplate.points.length < degrees) {
							selectedTemplate.points.push(_.cloneDeep(toPush));
						}
					});
				}

				// return all the templates mapped to their applicable edges to be drawn
				return _.flatten(_.map(tile.customTemplate, function(t) {

					var correctionAngle = num.getAngle(num.vectorFromEnds(tile.edges[t.startEdge].ends));

					var transformed = _.map(t.points, function(point) {
						var absVector = num.vecSub(num.getTranslation(point.transform),
							num.edgeInterpolate(tile.edges[t.startEdge].ends, t.startProportion));
						absVector.push(1);
						var corrected = num.rotateBy(absVector, correctionAngle);
						corrected.pop();
						return _.map(corrected, function(i) {
							return i / tile.edges[patternStart].length;
						});
					});


					return _.map(t.applicableEdges, function(i) {
						return {
							start: {
								index: i[0],
								proportion: i[2] ? 1 - t.startProportion: t.startProportion
							},
							end: {
								index: i[1],
								proportion: i[2] ? 1 - t.endProportion: t.endProportion
							},
							template: i[2] ? _.map(transformed, function(t) { return [-t[0], t[1]]; }) : transformed,
							isSymmetric: t.isSymmetric,
							isCropped: t.isCropped,
						};
					});
				}), true);
			}
		}
	},
];
d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

Array.prototype.extend = function(arr) {
	return Array.prototype.push.apply(this, arr);
};

Array.prototype.max = function() {
	return Math.max.apply(null, this);
};

Array.prototype.min = function() {
	return Math.min.apply(null, this);
};

Array.prototype.sum = function() {
	return _.reduce(this, function(sum, num) {
		return sum + num;
	}, 0);
};

Slider.prototype.setAttributes = function(attrs) {
	_.forOwn(attrs, function(num, key) {
		this.setAttribute(key, attrs[key]);
	});
};

Math.roundToPrecision = function(x, precision) {
	return Math.round(x * Math.pow(10,precision)) / Math.pow(10,precision);
};

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
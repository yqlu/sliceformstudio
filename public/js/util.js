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

var deepCustomizer = function(val) {
	if (typeof val !== "object") {
		return _.cloneDeep(val);
	} else {
		if (val.constructor === Array) {
			return _.map(val, function(i) {
				return _.cloneDeep(i, deepCustomizer);
			});
		} else {
			var clone = {};
			for (var prop in val) {
				if (!_.isElement(val[prop])) {
					if (prop === "edges" || prop === "patterns") {
						clone[prop] = _.map(val[prop], function(i) {
							return _.clone(i, shallowCustomizer);
						});
					} else {
						clone[prop] = _.cloneDeep(val[prop], deepCustomizer);
					}
				} else {
					// dom node; do nothing
				}
			}
			return clone;
		}
	}
};

var shallowCustomizer = function(val) {
	if (_.isElement(val)) {
		return null;
	} else {
		return val;
	}
};
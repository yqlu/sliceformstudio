d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

Array.prototype.extend = function(arr) {
	return Array.prototype.push.apply(this, arr);
}

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
}

Slider.prototype.setAttributes = function(attrs) {
	_.forOwn(attrs, function(num, key) {
		this.setAttribute(key, attrs[key]);
	});
}
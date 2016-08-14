var ExactSlider = function (element, options) {
	var _this = this;

	this.element = $(element)[0];
	this.bootstrapSlider = new Slider(element, options);
	this.exact = document.createElement('div');
	$(this.exact).addClass("sliderDisplay");
	$(this.exact).append("<input type='text' class='sliderText'/><span class='sliderLabel'></span>");
	this.element.parentNode.insertBefore(this.exact, this.element);
	this.sliderText = $(this.exact).find(".sliderText");
	this.sliderLabel = $(this.exact).find(".sliderLabel");

	if (options.unit) {
		$(this.exact).append("<span class='sliderUnit'>" + options.unit + "</span>");
		this.formatter = function(val) { return val + options.unit; };
		this.sliderUnit = $(this.exact).find(".sliderUnit");
		this.sliderText.css("padding-right", "18px");
	} else {
		this.formatter = function(val) { return val; };
	}

	if (options.converter) {
		this.converter = options.converter;
	} else {
		// identity
		this.converter = {
			forward: function(val) { return val; },
			backward: function(val) { return val; }
		};
	}

	this.bootstrapSlider.on("change", function(d) {
		var newVal = _this.converter.forward(d.newValue);
		_this.sliderText.val(newVal);
		_this.sliderLabel.text(_this.formatter(newVal));
	});

	$(this.exact).find(".sliderText").on("blur", function(d) {
		var val = _this.converter.backward(parseFloat(_this.sliderText.val()));
		_this.bootstrapSlider.setValue(val, false, true);
		var newVal = _this.converter.forward(_this.bootstrapSlider.getValue());
		_this.sliderText.val(newVal);
		_this.sliderLabel.text(_this.formatter(newVal));
	});

	function showInput(e, thisref){
		if (typeof thisref === 'undefined') {
			thisref = this;
		}
		$(thisref).off('click');
		var input = $(thisref).siblings('input');
		input.each(function(){$(this).show();});
		input.select();
		$(thisref).siblings('.sliderUnit').css("display", "inline");
		$(thisref).siblings('.selectize-control').css("display", "inline-block");
		$(thisref).hide();
	}

	function hideInput(e, thisref){
		if (typeof thisref === 'undefined') {
			thisref = this;
		}
		$(thisref).hide();
		$(thisref).siblings('.sliderUnit').hide();
		$(thisref).siblings('.sliderLabel').show();
		$(thisref).siblings('.sliderLabel').click(showInput);
	}

	this.sliderLabel.click(showInput);
    this.sliderText.blur(hideInput);
    this.sliderText.keyup(function(e) {
		if (e.keyCode == 13) {
			hideInput(e, this);
		}
    });
    this.sliderText.hide();
    if (options.unit) {
		this.sliderUnit.hide();
	}
    this.bootstrapSlider._trigger("change", {newValue: this.bootstrapSlider.getValue()});

    this.getValue = function() {
		return this.bootstrapSlider.getValue();
	};
    this.setValue = function(val) {
		return this.bootstrapSlider.setValue(val);
	};
	this.on = function(evt, callback) {
		this.bootstrapSlider.on(evt, callback);
		return this;
	};
	this.destroy = function() {
		this.bootstrapSlider.destroy();
		$(this.exact).remove();
	};

	return this;
};
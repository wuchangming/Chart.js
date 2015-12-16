/*!
 * Chart.js
 * http://chartjs.org/
 * Version: 2.0.0-beta
 *
 * Copyright 2015 Nick Downie
 * Released under the MIT license
 * https://github.com/nnnick/Chart.js/blob/master/LICENSE.md
 */


(function() {

	"use strict";

	//Declare root variable - window in the browser, global on the server
	var root = this,
		previous = root.Chart;

	//Occupy the global variable of Chart, and create a simple base class
	var Chart = function(context, config) {
		this.config = config;

		// Support a jQuery'd canvas element
		if (context.length && context[0].getContext) {
			context = context[0];
		}

		// Support a canvas domnode
		if (context.getContext) {
			context = context.getContext("2d");
		}

		this.ctx = context;
		this.canvas = context.canvas;

		// Figure out what the size of the chart will be.
		// If the canvas has a specified width and height, we use those else
		// we look to see if the canvas node has a CSS width and height.
		// If there is still no height, fill the parent container

		// hardCode!!!!!!!
		context.canvas.width = Chart.helpers.getMaximumWidth(context.canvas);
		context.canvas.height = parseInt(Chart.helpers.getStyle(context.canvas, 'height'));

		this.width = context.canvas.width || parseInt(Chart.helpers.getStyle(context.canvas, 'width')) || Chart.helpers.getMaximumWidth(context.canvas);
		this.height = context.canvas.height || parseInt(Chart.helpers.getStyle(context.canvas, 'height')) || Chart.helpers.getMaximumHeight(context.canvas);

		this.aspectRatio = this.width / this.height;

		if (isNaN(this.aspectRatio) || isFinite(this.aspectRatio) === false) {
			// If the canvas has no size, try and figure out what the aspect ratio will be.
			// Some charts prefer square canvases (pie, radar, etc). If that is specified, use that
			// else use the canvas default ratio of 2
			this.aspectRatio = config.aspectRatio !== undefined ? config.aspectRatio : 2;
		}

		// Store the original style of the element so we can set it back
		this.originalCanvasStyleWidth = context.canvas.style.width;
		this.originalCanvasStyleHeight = context.canvas.style.height;

		// High pixel density displays - multiply the size of the canvas height/width by the device pixel ratio, then scale.
		Chart.helpers.retinaScale(this);

		if (config) {
			this.controller = new Chart.Controller(this);
		}

		// Always bind this so that if the responsive state changes we still work
		var _this = this;
		Chart.helpers.addResizeListener(context.canvas.parentNode, function() {
			if (_this.controller && _this.controller.config.options.responsive) {
				_this.controller.resize();
			}
		});

		return this.controller ? this.controller : this;

	};

	//Globally expose the defaults to allow for user updating/changing
	Chart.defaults = {
		global: {
			responsive: true,
			responsiveAnimationDuration: 0,
			maintainAspectRatio: true,
			events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
			hover: {
				onHover: null,
				mode: 'single',
				animationDuration: 400,
			},
			onClick: null,
			defaultColor: 'rgba(0,0,0,0.1)',

			// Element defaults defined in element extensions
			elements: {},

			// Legend callback string
			legendCallback: function(chart) {
				var text = [];
				text.push('<ul class="' + chart.id + '-legend">');
				for (var i = 0; i < chart.data.datasets.length; i++) {
					text.push('<li><span style="background-color:' + chart.data.datasets[i].backgroundColor + '">');
					if (chart.data.datasets[i].label) {
						text.push(chart.data.datasets[i].label);
					}
					text.push('</span></li>');
				}
				text.push('</ul>');

				return text.join("");
			}
		},
	};

	if (typeof amd !== 'undefined') {
		define(function() {
			return Chart;
		});
	} else if (typeof module === 'object' && module.exports) {
		module.exports = Chart;
	}

	root.Chart = Chart;

	Chart.noConflict = function() {
		root.Chart = previous;
		return Chart;
	};

}).call(this);

(function() {

	"use strict";

	//Declare root variable - window in the browser, global on the server
	var root = this,
		Chart = root.Chart;

	//Global Chart helpers object for utility methods and classes
	var helpers = Chart.helpers = {};

	//-- Basic js utility methods
	var each = helpers.each = function(loopable, callback, self, reverse) {
			var additionalArgs = Array.prototype.slice.call(arguments, 3);
			// Check to see if null or undefined firstly.
			if (loopable) {
				if (loopable.length === +loopable.length) {
					var i;
					if (reverse) {
						for (i = loopable.length - 1; i >= 0; i--) {
							callback.apply(self, [loopable[i], i].concat(additionalArgs));
						}
					} else {
						for (i = 0; i < loopable.length; i++) {
							callback.apply(self, [loopable[i], i].concat(additionalArgs));
						}
					}
				} else {
					for (var item in loopable) {
						callback.apply(self, [loopable[item], item].concat(additionalArgs));
					}
				}
			}
		},
		clone = helpers.clone = function(obj) {
			var objClone = {};
			each(obj, function(value, key) {
				if (obj.hasOwnProperty(key)) {
					if (helpers.isArray(value)) {
						objClone[key] = value.slice(0);
					} else if (typeof value === 'object' && value !== null) {
						objClone[key] = clone(value);
					} else {
						objClone[key] = value;
					}
				}
			});
			return objClone;
		},
		extend = helpers.extend = function(base) {
			each(Array.prototype.slice.call(arguments, 1), function(extensionObject) {
				each(extensionObject, function(value, key) {
					if (extensionObject.hasOwnProperty(key)) {
						base[key] = value;
					}
				});
			});
			return base;
		},
		// Need a special merge function to chart configs since they are now grouped
		configMerge = helpers.configMerge = function(_base) {
			var base = clone(_base);
			helpers.each(Array.prototype.slice.call(arguments, 1), function(extension) {
				helpers.each(extension, function(value, key) {
					if (extension.hasOwnProperty(key)) {
						if (key === 'scales') {
							// Scale config merging is complex. Add out own function here for that
							base[key] = helpers.scaleMerge(base.hasOwnProperty(key) ? base[key] : {}, value);

						} else if (key === 'scale') {
							// Used in polar area & radar charts since there is only one scale
							base[key] = helpers.configMerge(base.hasOwnProperty(key) ? base[key] : {}, Chart.scaleService.getScaleDefaults(value.type), value);
						} else if (base.hasOwnProperty(key) && helpers.isArray(base[key]) && helpers.isArray(value)) {
							// In this case we have an array of objects replacing another array. Rather than doing a strict replace,
							// merge. This allows easy scale option merging
							var baseArray = base[key];

							helpers.each(value, function(valueObj, index) {

								if (index < baseArray.length) {
									if (typeof baseArray[index] == 'object' && baseArray[index] !== null && typeof valueObj == 'object' && valueObj !== null) {
										// Two objects are coming together. Do a merge of them.
										baseArray[index] = helpers.configMerge(baseArray[index], valueObj);
									} else {
										// Just overwrite in this case since there is nothing to merge
										baseArray[index] = valueObj;
									}
								} else {
									baseArray.push(valueObj); // nothing to merge
								}
							});

						} else if (base.hasOwnProperty(key) && typeof base[key] == "object" && base[key] !== null && typeof value == "object") {
							// If we are overwriting an object with an object, do a merge of the properties.
							base[key] = helpers.configMerge(base[key], value);

						} else {
							// can just overwrite the value in this case
							base[key] = value;
						}
					}
				});
			});

			return base;
		},
		extendDeep = helpers.extendDeep = function(_base) {
			return _extendDeep.apply(this, arguments);

			function _extendDeep(dst) {
				helpers.each(arguments, function(obj) {
					if (obj !== dst) {
						helpers.each(obj, function(value, key) {
							if (dst[key] && dst[key].constructor && dst[key].constructor === Object) {
								_extendDeep(dst[key], value);
							} else {
								dst[key] = value;
							}
						});
					}
				});
				return dst;
			}
		},
		scaleMerge = helpers.scaleMerge = function(_base, extension) {
			var base = clone(_base);

			helpers.each(extension, function(value, key) {
				if (extension.hasOwnProperty(key)) {
					if (key === 'xAxes' || key === 'yAxes') {
						// These properties are arrays of items
						if (base.hasOwnProperty(key)) {
							helpers.each(value, function(valueObj, index) {
								if (index >= base[key].length || !base[key][index].type) {
									base[key].push(helpers.configMerge(valueObj.type ? Chart.scaleService.getScaleDefaults(valueObj.type) : {}, valueObj));
								} else if (valueObj.type !== base[key][index].type) {
									// Type changed. Bring in the new defaults before we bring in valueObj so that valueObj can override the correct scale defaults
									base[key][index] = helpers.configMerge(base[key][index], valueObj.type ? Chart.scaleService.getScaleDefaults(valueObj.type) : {}, valueObj);
								} else {
									// Type is the same
									base[key][index] = helpers.configMerge(base[key][index], valueObj);
								}
							});
						} else {
							base[key] = [];
							helpers.each(value, function(valueObj) {
								base[key].push(helpers.configMerge(valueObj.type ? Chart.scaleService.getScaleDefaults(valueObj.type) : {}, valueObj));
							});
						}
					} else if (base.hasOwnProperty(key) && typeof base[key] == "object" && base[key] !== null && typeof value == "object") {
						// If we are overwriting an object with an object, do a merge of the properties.
						base[key] = helpers.configMerge(base[key], value);

					} else {
						// can just overwrite the value in this case
						base[key] = value;
					}
				}
			});

			return base;
		},
		getValueAtIndexOrDefault = helpers.getValueAtIndexOrDefault = function(value, index, defaultValue) {
			if (value === undefined || value === null) {
				return defaultValue;
			}

			if (helpers.isArray(value)) {
				return index < value.length ? value[index] : defaultValue;
			}

			return value;
		},
		indexOf = helpers.indexOf = function(arrayToSearch, item) {
			if (Array.prototype.indexOf) {
				return arrayToSearch.indexOf(item);
			} else {
				for (var i = 0; i < arrayToSearch.length; i++) {
					if (arrayToSearch[i] === item) return i;
				}
				return -1;
			}
		},
		where = helpers.where = function(collection, filterCallback) {
			var filtered = [];

			helpers.each(collection, function(item) {
				if (filterCallback(item)) {
					filtered.push(item);
				}
			});

			return filtered;
		},
		findNextWhere = helpers.findNextWhere = function(arrayToSearch, filterCallback, startIndex) {
			// Default to start of the array
			if (startIndex === undefined || startIndex === null) {
				startIndex = -1;
			}
			for (var i = startIndex + 1; i < arrayToSearch.length; i++) {
				var currentItem = arrayToSearch[i];
				if (filterCallback(currentItem)) {
					return currentItem;
				}
			}
		},
		findPreviousWhere = helpers.findPreviousWhere = function(arrayToSearch, filterCallback, startIndex) {
			// Default to end of the array
			if (startIndex === undefined || startIndex === null) {
				startIndex = arrayToSearch.length;
			}
			for (var i = startIndex - 1; i >= 0; i--) {
				var currentItem = arrayToSearch[i];
				if (filterCallback(currentItem)) {
					return currentItem;
				}
			}
		},
		inherits = helpers.inherits = function(extensions) {
			//Basic javascript inheritance based on the model created in Backbone.js
			var parent = this;
			var ChartElement = (extensions && extensions.hasOwnProperty("constructor")) ? extensions.constructor : function() {
				return parent.apply(this, arguments);
			};

			var Surrogate = function() {
				this.constructor = ChartElement;
			};
			Surrogate.prototype = parent.prototype;
			ChartElement.prototype = new Surrogate();

			ChartElement.extend = inherits;

			if (extensions) extend(ChartElement.prototype, extensions);

			ChartElement.__super__ = parent.prototype;

			return ChartElement;
		},
		noop = helpers.noop = function() {},
		uid = helpers.uid = (function() {
			var id = 0;
			return function() {
				return "chart-" + id++;
			};
		})(),
		warn = helpers.warn = function(str) {
			//Method for warning of errors
			if (window.console && typeof window.console.warn === "function") console.warn(str);
		},
		amd = helpers.amd = (typeof define === 'function' && define.amd),
		//-- Math methods
		isNumber = helpers.isNumber = function(n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		},
		max = helpers.max = function(array) {
			return Math.max.apply(Math, array);
		},
		min = helpers.min = function(array) {
			return Math.min.apply(Math, array);
		},
		sign = helpers.sign = function(x) {
			if (Math.sign) {
				return Math.sign(x);
			} else {
				x = +x; // convert to a number
				if (x === 0 || isNaN(x)) {
					return x;
				}
				return x > 0 ? 1 : -1;
			}
		},
		log10 = helpers.log10 = function(x) {
			if (Math.log10) {
				return Math.log10(x);
			} else {
				return Math.log(x) / Math.LN10;
			}
		},
		getDecimalPlaces = helpers.getDecimalPlaces = function(num) {
			if (num % 1 !== 0 && isNumber(num)) {
				var s = num.toString();
				if (s.indexOf("e-") < 0) {
					// no exponent, e.g. 0.01
					return s.split(".")[1].length;
				} else if (s.indexOf(".") < 0) {
					// no decimal point, e.g. 1e-9
					return parseInt(s.split("e-")[1]);
				} else {
					// exponent and decimal point, e.g. 1.23e-9
					var parts = s.split(".")[1].split("e-");
					return parts[0].length + parseInt(parts[1]);
				}
			} else {
				return 0;
			}
		},
		toRadians = helpers.toRadians = function(degrees) {
			return degrees * (Math.PI / 180);
		},
		toDegrees = helpers.toDegrees = function(radians) {
			return radians * (180 / Math.PI);
		},
		// Gets the angle from vertical upright to the point about a centre.
		getAngleFromPoint = helpers.getAngleFromPoint = function(centrePoint, anglePoint) {
			var distanceFromXCenter = anglePoint.x - centrePoint.x,
				distanceFromYCenter = anglePoint.y - centrePoint.y,
				radialDistanceFromCenter = Math.sqrt(distanceFromXCenter * distanceFromXCenter + distanceFromYCenter * distanceFromYCenter);

			var angle = Math.atan2(distanceFromYCenter, distanceFromXCenter);

			if (angle < (-0.5 * Math.PI)) {
				angle += 2.0 * Math.PI; // make sure the returned angle is in the range of (-PI/2, 3PI/2]
			}

			return {
				angle: angle,
				distance: radialDistanceFromCenter
			};
		},
		aliasPixel = helpers.aliasPixel = function(pixelWidth) {
			return (pixelWidth % 2 === 0) ? 0 : 0.5;
		},
		splineCurve = helpers.splineCurve = function(firstPoint, middlePoint, afterPoint, t) {
			//Props to Rob Spencer at scaled innovation for his post on splining between points
			//http://scaledinnovation.com/analytics/splines/aboutSplines.html

			// This function must also respect "skipped" points

			var previous = firstPoint.skip ? middlePoint : firstPoint,
				current = middlePoint,
				next = afterPoint.skip ? middlePoint : afterPoint;

			var d01 = Math.sqrt(Math.pow(current.x - previous.x, 2) + Math.pow(current.y - previous.y, 2));
			var d12 = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));

			var s01 = d01 / (d01 + d12);
			var s12 = d12 / (d01 + d12);

			// If all points are the same, s01 & s02 will be inf
			s01 = isNaN(s01) ? 0 : s01;
			s12 = isNaN(s12) ? 0 : s12;

			var fa = t * s01; // scaling factor for triangle Ta
			var fb = t * s12;

			return {
				previous: {
					x: current.x - fa * (next.x - previous.x),
					y: current.y - fa * (next.y - previous.y)
				},
				next: {
					x: current.x + fb * (next.x - previous.x),
					y: current.y + fb * (next.y - previous.y)
				}
			};
		},
		nextItem = helpers.nextItem = function(collection, index, loop) {
			if (loop) {
				return index >= collection.length - 1 ? collection[0] : collection[index + 1];
			}

			return index >= collection.length - 1 ? collection[collection.length - 1] : collection[index + 1];
		},
		previousItem = helpers.previousItem = function(collection, index, loop) {
			if (loop) {
				return index <= 0 ? collection[collection.length - 1] : collection[index - 1];
			}
			return index <= 0 ? collection[0] : collection[index - 1];
		},
		// Implementation of the nice number algorithm used in determining where axis labels will go
		niceNum = helpers.niceNum = function(range, round) {
			var exponent = Math.floor(helpers.log10(range));
			var fraction = range / Math.pow(10, exponent);
			var niceFraction;

			if (round) {
				if (fraction < 1.5) {
					niceFraction = 1;
				} else if (fraction < 3) {
					niceFraction = 2;
				} else if (fraction < 7) {
					niceFraction = 5;
				} else {
					niceFraction = 10;
				}
			} else {
				if (fraction <= 1.0) {
					niceFraction = 1;
				} else if (fraction <= 2) {
					niceFraction = 2;
				} else if (fraction <= 5) {
					niceFraction = 5;
				} else {
					niceFraction = 10;
				}
			}

			return niceFraction * Math.pow(10, exponent);
		},
		//Easing functions adapted from Robert Penner's easing equations
		//http://www.robertpenner.com/easing/
		easingEffects = helpers.easingEffects = {
			linear: function(t) {
				return t;
			},
			easeInQuad: function(t) {
				return t * t;
			},
			easeOutQuad: function(t) {
				return -1 * t * (t - 2);
			},
			easeInOutQuad: function(t) {
				if ((t /= 1 / 2) < 1) {
					return 1 / 2 * t * t;
				}
				return -1 / 2 * ((--t) * (t - 2) - 1);
			},
			easeInCubic: function(t) {
				return t * t * t;
			},
			easeOutCubic: function(t) {
				return 1 * ((t = t / 1 - 1) * t * t + 1);
			},
			easeInOutCubic: function(t) {
				if ((t /= 1 / 2) < 1) {
					return 1 / 2 * t * t * t;
				}
				return 1 / 2 * ((t -= 2) * t * t + 2);
			},
			easeInQuart: function(t) {
				return t * t * t * t;
			},
			easeOutQuart: function(t) {
				return -1 * ((t = t / 1 - 1) * t * t * t - 1);
			},
			easeInOutQuart: function(t) {
				if ((t /= 1 / 2) < 1) {
					return 1 / 2 * t * t * t * t;
				}
				return -1 / 2 * ((t -= 2) * t * t * t - 2);
			},
			easeInQuint: function(t) {
				return 1 * (t /= 1) * t * t * t * t;
			},
			easeOutQuint: function(t) {
				return 1 * ((t = t / 1 - 1) * t * t * t * t + 1);
			},
			easeInOutQuint: function(t) {
				if ((t /= 1 / 2) < 1) {
					return 1 / 2 * t * t * t * t * t;
				}
				return 1 / 2 * ((t -= 2) * t * t * t * t + 2);
			},
			easeInSine: function(t) {
				return -1 * Math.cos(t / 1 * (Math.PI / 2)) + 1;
			},
			easeOutSine: function(t) {
				return 1 * Math.sin(t / 1 * (Math.PI / 2));
			},
			easeInOutSine: function(t) {
				return -1 / 2 * (Math.cos(Math.PI * t / 1) - 1);
			},
			easeInExpo: function(t) {
				return (t === 0) ? 1 : 1 * Math.pow(2, 10 * (t / 1 - 1));
			},
			easeOutExpo: function(t) {
				return (t === 1) ? 1 : 1 * (-Math.pow(2, -10 * t / 1) + 1);
			},
			easeInOutExpo: function(t) {
				if (t === 0) {
					return 0;
				}
				if (t === 1) {
					return 1;
				}
				if ((t /= 1 / 2) < 1) {
					return 1 / 2 * Math.pow(2, 10 * (t - 1));
				}
				return 1 / 2 * (-Math.pow(2, -10 * --t) + 2);
			},
			easeInCirc: function(t) {
				if (t >= 1) {
					return t;
				}
				return -1 * (Math.sqrt(1 - (t /= 1) * t) - 1);
			},
			easeOutCirc: function(t) {
				return 1 * Math.sqrt(1 - (t = t / 1 - 1) * t);
			},
			easeInOutCirc: function(t) {
				if ((t /= 1 / 2) < 1) {
					return -1 / 2 * (Math.sqrt(1 - t * t) - 1);
				}
				return 1 / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1);
			},
			easeInElastic: function(t) {
				var s = 1.70158;
				var p = 0;
				var a = 1;
				if (t === 0) {
					return 0;
				}
				if ((t /= 1) == 1) {
					return 1;
				}
				if (!p) {
					p = 1 * 0.3;
				}
				if (a < Math.abs(1)) {
					a = 1;
					s = p / 4;
				} else {
					s = p / (2 * Math.PI) * Math.asin(1 / a);
				}
				return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * 1 - s) * (2 * Math.PI) / p));
			},
			easeOutElastic: function(t) {
				var s = 1.70158;
				var p = 0;
				var a = 1;
				if (t === 0) {
					return 0;
				}
				if ((t /= 1) == 1) {
					return 1;
				}
				if (!p) {
					p = 1 * 0.3;
				}
				if (a < Math.abs(1)) {
					a = 1;
					s = p / 4;
				} else {
					s = p / (2 * Math.PI) * Math.asin(1 / a);
				}
				return a * Math.pow(2, -10 * t) * Math.sin((t * 1 - s) * (2 * Math.PI) / p) + 1;
			},
			easeInOutElastic: function(t) {
				var s = 1.70158;
				var p = 0;
				var a = 1;
				if (t === 0) {
					return 0;
				}
				if ((t /= 1 / 2) == 2) {
					return 1;
				}
				if (!p) {
					p = 1 * (0.3 * 1.5);
				}
				if (a < Math.abs(1)) {
					a = 1;
					s = p / 4;
				} else {
					s = p / (2 * Math.PI) * Math.asin(1 / a);
				}
				if (t < 1) {
					return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * 1 - s) * (2 * Math.PI) / p));
				}
				return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * 1 - s) * (2 * Math.PI) / p) * 0.5 + 1;
			},
			easeInBack: function(t) {
				var s = 1.70158;
				return 1 * (t /= 1) * t * ((s + 1) * t - s);
			},
			easeOutBack: function(t) {
				var s = 1.70158;
				return 1 * ((t = t / 1 - 1) * t * ((s + 1) * t + s) + 1);
			},
			easeInOutBack: function(t) {
				var s = 1.70158;
				if ((t /= 1 / 2) < 1) {
					return 1 / 2 * (t * t * (((s *= (1.525)) + 1) * t - s));
				}
				return 1 / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2);
			},
			easeInBounce: function(t) {
				return 1 - easingEffects.easeOutBounce(1 - t);
			},
			easeOutBounce: function(t) {
				if ((t /= 1) < (1 / 2.75)) {
					return 1 * (7.5625 * t * t);
				} else if (t < (2 / 2.75)) {
					return 1 * (7.5625 * (t -= (1.5 / 2.75)) * t + 0.75);
				} else if (t < (2.5 / 2.75)) {
					return 1 * (7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375);
				} else {
					return 1 * (7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375);
				}
			},
			easeInOutBounce: function(t) {
				if (t < 1 / 2) {
					return easingEffects.easeInBounce(t * 2) * 0.5;
				}
				return easingEffects.easeOutBounce(t * 2 - 1) * 0.5 + 1 * 0.5;
			}
		},
		//Request animation polyfill - http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
		requestAnimFrame = helpers.requestAnimFrame = (function() {
			return window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.oRequestAnimationFrame ||
				window.msRequestAnimationFrame ||
				function(callback) {
					return window.setTimeout(callback, 1000 / 60);
				};
		})(),
		cancelAnimFrame = helpers.cancelAnimFrame = (function() {
			return window.cancelAnimationFrame ||
				window.webkitCancelAnimationFrame ||
				window.mozCancelAnimationFrame ||
				window.oCancelAnimationFrame ||
				window.msCancelAnimationFrame ||
				function(callback) {
					return window.clearTimeout(callback, 1000 / 60);
				};
		})(),
		//-- DOM methods
		getRelativePosition = helpers.getRelativePosition = function(evt, chart) {
			var mouseX, mouseY;
			var e = evt.originalEvent || evt,
				canvas = evt.currentTarget || evt.srcElement,
				boundingRect = canvas.getBoundingClientRect();

			if (e.touches && e.touches.length > 0) {
				mouseX = e.touches[0].clientX;
				mouseY = e.touches[0].clientY;

			} else {
				mouseX = e.clientX;
				mouseY = e.clientY;
			}

			// Scale mouse coordinates into canvas coordinates
			// by following the pattern laid out by 'jerryj' in the comments of
			// http://www.html5canvastutorials.com/advanced/html5-canvas-mouse-coordinates/

			// We divide by the current device pixel ratio, because the canvas is scaled up by that amount in each direction. However
			// the backend model is in unscaled coordinates. Since we are going to deal with our model coordinates, we go back here
			mouseX = Math.round((mouseX - boundingRect.left) / (boundingRect.right - boundingRect.left) * canvas.width / chart.currentDevicePixelRatio);
			mouseY = Math.round((mouseY - boundingRect.top) / (boundingRect.bottom - boundingRect.top) * canvas.height / chart.currentDevicePixelRatio);

			return {
				x: mouseX,
				y: mouseY
			};

		},
		addEvent = helpers.addEvent = function(node, eventType, method) {
			if (node.addEventListener) {
				node.addEventListener(eventType, method);
			} else if (node.attachEvent) {
				node.attachEvent("on" + eventType, method);
			} else {
				node["on" + eventType] = method;
			}
		},
		removeEvent = helpers.removeEvent = function(node, eventType, handler) {
			if (node.removeEventListener) {
				node.removeEventListener(eventType, handler, false);
			} else if (node.detachEvent) {
				node.detachEvent("on" + eventType, handler);
			} else {
				node["on" + eventType] = noop;
			}
		},
		bindEvents = helpers.bindEvents = function(chartInstance, arrayOfEvents, handler) {
			// Create the events object if it's not already present
			if (!chartInstance.events) chartInstance.events = {};

			each(arrayOfEvents, function(eventName) {
				chartInstance.events[eventName] = function() {
					handler.apply(chartInstance, arguments);
				};
				addEvent(chartInstance.chart.canvas, eventName, chartInstance.events[eventName]);
			});
		},
		unbindEvents = helpers.unbindEvents = function(chartInstance, arrayOfEvents) {
			each(arrayOfEvents, function(handler, eventName) {
				removeEvent(chartInstance.chart.canvas, eventName, handler);
			});
		},
		getConstraintWidth = helpers.getConstraintWidth = function(domNode) { // returns Number or undefined if no constraint
			var constrainedWidth;
			var constrainedWNode = document.defaultView.getComputedStyle(domNode)['max-width'];
			var constrainedWContainer = document.defaultView.getComputedStyle(domNode.parentNode)['max-width'];
			var hasCWNode = constrainedWNode !== null && constrainedWNode !== "none";
			var hasCWContainer = constrainedWContainer !== null && constrainedWContainer !== "none";

			if (hasCWNode || hasCWContainer) {
				constrainedWidth = Math.min((hasCWNode ? parseInt(constrainedWNode, 10) : Number.POSITIVE_INFINITY), (hasCWContainer ? parseInt(constrainedWContainer, 10) : Number.POSITIVE_INFINITY));
			}
			return constrainedWidth;
		},
		getConstraintHeight = helpers.getConstraintHeight = function(domNode) { // returns Number or undefined if no constraint

			var constrainedHeight;
			var constrainedHNode = document.defaultView.getComputedStyle(domNode)['max-height'];
			var constrainedHContainer = document.defaultView.getComputedStyle(domNode.parentNode)['max-height'];
			var hasCHNode = constrainedHNode !== null && constrainedHNode !== "none";
			var hasCHContainer = constrainedHContainer !== null && constrainedHContainer !== "none";

			if (constrainedHNode || constrainedHContainer) {
				constrainedHeight = Math.min((hasCHNode ? parseInt(constrainedHNode, 10) : Number.POSITIVE_INFINITY), (hasCHContainer ? parseInt(constrainedHContainer, 10) : Number.POSITIVE_INFINITY));
			}
			return constrainedHeight;
		},
		getMaximumWidth = helpers.getMaximumWidth = function(domNode) {
			var container = domNode.parentNode;
			var padding = parseInt(getStyle(container, 'padding-left')) + parseInt(getStyle(container, 'padding-right'));

			var w = container.clientWidth - padding;
			var cw = getConstraintWidth(domNode);
			if (cw !== undefined) {
				w = Math.min(w, cw);
			}

			return w;
		},
		getMaximumHeight = helpers.getMaximumHeight = function(domNode) {
			var container = domNode.parentNode;
			var padding = parseInt(getStyle(container, 'padding-top')) + parseInt(getStyle(container, 'padding-bottom'));

			var h = container.clientHeight - padding;
			var ch = getConstraintHeight(domNode);
			if (ch !== undefined) {
				h = Math.min(h, ch);
			}

			return h;
		},
		getStyle = helpers.getStyle = function(el, property) {
			return el.currentStyle ?
				el.currentStyle[property] :
				document.defaultView.getComputedStyle(el, null).getPropertyValue(property);
		},
		getMaximumSize = helpers.getMaximumSize = helpers.getMaximumWidth, // legacy support
		retinaScale = helpers.retinaScale = function(chart) {
			var ctx = chart.ctx;
			var width = chart.canvas.width;
			var height = chart.canvas.height;
			var pixelRatio = chart.currentDevicePixelRatio = window.devicePixelRatio || 1;

			if (pixelRatio !== 1) {
				ctx.canvas.height = height * pixelRatio;
				ctx.canvas.width = width * pixelRatio;
				ctx.scale(pixelRatio, pixelRatio);

				ctx.canvas.style.width = width + 'px';
				ctx.canvas.style.height = height + 'px';

				// Store the device pixel ratio so that we can go backwards in `destroy`.
				// The devicePixelRatio changes with zoom, so there are no guarantees that it is the same
				// when destroy is called
				chart.originalDevicePixelRatio = chart.originalDevicePixelRatio || pixelRatio;
			}
		},
		//-- Canvas methods
		clear = helpers.clear = function(chart) {
			chart.ctx.clearRect(0, 0, chart.width, chart.height);
		},
		fontString = helpers.fontString = function(pixelSize, fontStyle, fontFamily) {
			return fontStyle + " " + pixelSize + "px " + fontFamily;
		},
		longestText = helpers.longestText = function(ctx, font, arrayOfStrings) {
			ctx.font = font;
			var longest = 0;
			each(arrayOfStrings, function(string) {
				var textWidth = ctx.measureText(string).width;
				longest = (textWidth > longest) ? textWidth : longest;
			});
			return longest;
		},
		drawRoundedRectangle = helpers.drawRoundedRectangle = function(ctx, x, y, width, height, radius) {
			ctx.beginPath();
			ctx.moveTo(x + radius, y);
			ctx.lineTo(x + width - radius, y);
			ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
			ctx.lineTo(x + width, y + height - radius);
			ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
			ctx.lineTo(x + radius, y + height);
			ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
			ctx.lineTo(x, y + radius);
			ctx.quadraticCurveTo(x, y, x + radius, y);
			ctx.closePath();
		},
		color = helpers.color = function(color) {
			if (!window.Color) {
				console.log('Color.js not found!');
				return color;
			}
			return window.Color(color);
		},
		addResizeListener = helpers.addResizeListener = function(node, callback) {
			return;
			// Hide an iframe before the node
			var hiddenIframe = document.createElement('iframe');
			var hiddenIframeClass = 'chartjs-hidden-iframe';

			if (hiddenIframe.classlist) {
				// can use classlist
				hiddenIframe.classlist.add(hiddenIframeClass);
			} else {
				hiddenIframe.setAttribute('class', hiddenIframeClass);
			}

			// Set the style
			hiddenIframe.style.width = '100%';
			hiddenIframe.style.display = 'block';
			hiddenIframe.style.border = 0;
			hiddenIframe.style.height = 0;
			hiddenIframe.style.margin = 0;
			hiddenIframe.style.position = 'absolute';
			hiddenIframe.style.left = 0;
			hiddenIframe.style.right = 0;
			hiddenIframe.style.top = 0;
			hiddenIframe.style.bottom = 0;

			// Insert the iframe so that contentWindow is available
			node.insertBefore(hiddenIframe, node.firstChild);

			var timer = 0;
			(hiddenIframe.contentWindow || hiddenIframe).onresize = function() {
				if (callback) {
					callback();
				}
			};
		},
		removeResizeListener = helpers.removeResizeListener = function(node) {
			var hiddenIframe = node.querySelector('.chartjs-hidden-iframe');

			// Remove the resize detect iframe
			if (hiddenIframe) {
				hiddenIframe.parentNode.removeChild(hiddenIframe);
			}
		},
		isArray = helpers.isArray = function(obj) {
			if (!Array.isArray) {
				return Object.prototype.toString.call(arg) === '[object Array]';
			}
			return Array.isArray(obj);
		},
		isDatasetVisible = helpers.isDatasetVisible = function(dataset) {
			return !dataset.hidden;
		};
}).call(this);

(function() {

	"use strict";

	//Declare root variable - window in the browser, global on the server
	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.elements = {};

	Chart.Element = function(configuration) {
		helpers.extend(this, configuration);
		this.initialize.apply(this, arguments);
	};
	helpers.extend(Chart.Element.prototype, {
		initialize: function() {},
		pivot: function() {
			if (!this._view) {
				this._view = helpers.clone(this._model);
			}
			this._start = helpers.clone(this._view);
			return this;
		},
		transition: function(ease) {
			if (!this._view) {
				this._view = helpers.clone(this._model);
			}
			if (!this._start) {
				this.pivot();
			}

			helpers.each(this._model, function(value, key) {

				if (key[0] === '_' || !this._model.hasOwnProperty(key)) {
					// Only non-underscored properties
				}

				// Init if doesn't exist
				else if (!this._view[key]) {
					if (typeof value === 'number' && isNaN(this._view[key]) === false) {
						this._view[key] = value * ease;
					} else {
						this._view[key] = value || null;
					}
				}

				// No unnecessary computations
				else if (this._model[key] === this._view[key]) {
					// It's the same! Woohoo!
				}

				// Color transitions if possible
				else if (typeof value === 'string') {
					try {
						var color = helpers.color(this._start[key]).mix(helpers.color(this._model[key]), ease);
						this._view[key] = color.rgbString();
					} catch (err) {
						this._view[key] = value;
					}
				}
				// Number transitions
				else if (typeof value === 'number') {
					var startVal = this._start[key] !== undefined && isNaN(this._start[key]) === false ? this._start[key] : 0;
					this._view[key] = ((this._model[key] - startVal) * ease) + startVal;
				}
				// Everything else
				else {
					this._view[key] = value;
				}
			}, this);

			if (ease === 1) {
				delete this._start;
			}
			return this;
		},
		tooltipPosition: function() {
			return {
				x: this._model.x,
				y: this._model.y
			};
		},
		hasValue: function() {
			return helpers.isNumber(this._model.x) && helpers.isNumber(this._model.y);
		}
	});

	Chart.Element.extend = helpers.inherits;

}).call(this);

(function() {

	"use strict";

	//Declare root variable - window in the browser, global on the server
	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;


	//Create a dictionary of chart types, to allow for extension of existing types
	Chart.types = {};

	//Store a reference to each instance - allowing us to globally resize chart instances on window resize.
	//Destroy method on the chart will remove the instance of the chart from this reference.
	Chart.instances = {};

	// Controllers available for dataset visualization eg. bar, line, slice, etc.
	Chart.controllers = {};

	// The main controller of a chart
	Chart.Controller = function(instance) {

		this.chart = instance;
		this.config = instance.config;
		this.options = this.config.options = helpers.configMerge(Chart.defaults.global, Chart.defaults[this.config.type], this.config.options || {});
		this.id = helpers.uid();

		Object.defineProperty(this, 'data', {
			get: function() {
				return this.config.data;
			},
		});

		//Add the chart instance to the global namespace
		Chart.instances[this.id] = this;

		if (this.options.responsive) {
			// Silent resize before chart draws
			this.resize(true);
		}

		this.initialize.call(this);

		return this;
	};

	helpers.extend(Chart.Controller.prototype, {

		initialize: function initialize() {

			// TODO
			// If BeforeInit(this) doesn't return false, proceed

			this.bindEvents();

			// Make sure controllers are built first so that each dataset is bound to an axis before the scales
			// are built
			this.ensureScalesHaveIDs();
			this.buildOrUpdateControllers();
			this.buildScales();
			this.resetElements();
			this.initToolTip();
			this.update();

			// TODO
			// If AfterInit(this) doesn't return false, proceed

			return this;
		},

		clear: function clear() {
			helpers.clear(this.chart);
			return this;
		},

		stop: function stop() {
			// Stops any current animation loop occuring
			Chart.animationService.cancelAnimation(this);
			return this;
		},

		resize: function resize(silent) {
			this.stop();
			var canvas = this.chart.canvas;
			var newWidth = helpers.getMaximumWidth(this.chart.canvas);
			var newHeight = (this.options.maintainAspectRatio && isNaN(this.chart.aspectRatio) === false && isFinite(this.chart.aspectRatio) && this.chart.aspectRatio !== 0) ? newWidth / this.chart.aspectRatio : helpers.getMaximumHeight(this.chart.canvas);

			canvas.width = this.chart.width = newWidth;
			canvas.height = this.chart.height = newHeight;

			helpers.retinaScale(this.chart);

			if (!silent) {
				this.update(this.options.responsiveAnimationDuration);
			}

			return this;
		},
		ensureScalesHaveIDs: function ensureScalesHaveIDs() {
			var defaultXAxisID = 'x-axis-';
			var defaultYAxisID = 'y-axis-';

			if (this.options.scales) {
				if (this.options.scales.xAxes && this.options.scales.xAxes.length) {
					helpers.each(this.options.scales.xAxes, function(xAxisOptions, index) {
						xAxisOptions.id = xAxisOptions.id || (defaultXAxisID + index);
					}, this);
				}

				if (this.options.scales.yAxes && this.options.scales.yAxes.length) {
					// Build the y axes
					helpers.each(this.options.scales.yAxes, function(yAxisOptions, index) {
						yAxisOptions.id = yAxisOptions.id || (defaultYAxisID + index);
					}, this);
				}
			}
		},
		buildScales: function buildScales() {
			// Map of scale ID to scale object so we can lookup later
			this.scales = {};

			// Build the x axes
			if (this.options.scales) {
				if (this.options.scales.xAxes && this.options.scales.xAxes.length) {
					helpers.each(this.options.scales.xAxes, function(xAxisOptions, index) {
						var ScaleClass = Chart.scaleService.getScaleConstructor(xAxisOptions.type);
						var scale = new ScaleClass({
							ctx: this.chart.ctx,
							options: xAxisOptions,
							chart: this,
							id: xAxisOptions.id,
						});

						this.scales[scale.id] = scale;
					}, this);
				}

				if (this.options.scales.yAxes && this.options.scales.yAxes.length) {
					// Build the y axes
					helpers.each(this.options.scales.yAxes, function(yAxisOptions, index) {
						var ScaleClass = Chart.scaleService.getScaleConstructor(yAxisOptions.type);
						var scale = new ScaleClass({
							ctx: this.chart.ctx,
							options: yAxisOptions,
							chart: this,
							id: yAxisOptions.id,
						});

						this.scales[scale.id] = scale;
					}, this);
				}
			}
			if (this.options.scale) {
				// Build radial axes
				var ScaleClass = Chart.scaleService.getScaleConstructor(this.options.scale.type);
				var scale = new ScaleClass({
					ctx: this.chart.ctx,
					options: this.options.scale,
					chart: this,
				});

				this.scale = scale;

				this.scales.radialScale = scale;
			}

			Chart.scaleService.update(this, this.chart.width, this.chart.height);
		},

		buildOrUpdateControllers: function buildOrUpdateControllers(resetNewControllers) {
			var types = [];
			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				if (!dataset.type) {
					dataset.type = this.config.type;
				}

				var type = dataset.type;
				types.push(type);

				if (dataset.controller) {
					dataset.controller.updateIndex(datasetIndex);
					return;
				}

				dataset.controller = new Chart.controllers[type](this, datasetIndex);

				if (resetNewControllers) {
					dataset.controller.reset();
				}
			}, this);

			if (types.length > 1) {
				for (var i = 1; i < types.length; i++) {
					if (types[i] != types[i - 1]) {
						this.isCombo = true;
						break;
					}
				}
			}
		},

		resetElements: function resetElements() {
			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				dataset.controller.reset();
			}, this);
		},

		update: function update(animationDuration, lazy) {
			// In case the entire data object changed
			this.tooltip._data = this.data;

			Chart.scaleService.update(this, this.chart.width, this.chart.height);

			// Make sure dataset controllers are updated and new controllers are reset
			this.buildOrUpdateControllers(true);

			// Make sure all dataset controllers have correct meta data counts
			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				dataset.controller.buildOrUpdateElements();
			}, this);

			// This will loop through any data and do the appropriate element update for the type
			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				dataset.controller.update();
			}, this);
			this.render(animationDuration, lazy);
		},

		render: function render(duration, lazy) {

			if ((typeof duration !== 'undefined' && duration !== 0) || (typeof duration == 'undefined' && this.options.animation.duration !== 0)) {
				var animation = new Chart.Animation();
				animation.numSteps = (duration || this.options.animation.duration) / 16.66; //60 fps
				animation.easing = this.options.animation.easing;

				// render function
				animation.render = function(chartInstance, animationObject) {
					var easingFunction = helpers.easingEffects[animationObject.easing];
					var stepDecimal = animationObject.currentStep / animationObject.numSteps;
					var easeDecimal = easingFunction(stepDecimal);

					chartInstance.draw(easeDecimal, stepDecimal, animationObject.currentStep);
				};

				// user events
				animation.onAnimationProgress = this.options.onAnimationProgress;
				animation.onAnimationComplete = this.options.onAnimationComplete;

				Chart.animationService.addAnimation(this, animation, duration, lazy);
			} else {
				this.draw();
				if (this.options.onAnimationComplete && this.options.onAnimationComplete.call) {
					this.options.onAnimationComplete.call(this);
				}
			}
			return this;
		},

		draw: function(ease) {
			var easingDecimal = ease || 1;
			this.clear();

			// Draw all the scales
			helpers.each(this.scales, function(scale) {
				scale.draw(this.chartArea);
			}, this);
			if (this.scale) {
				this.scale.draw();
			}

			// Draw each dataset via its respective controller (reversed to support proper line stacking)
			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				if (helpers.isDatasetVisible(dataset)) {
					dataset.controller.draw(ease);
				}
			}, this);

			// Finally draw the tooltip
			this.tooltip.transition(easingDecimal).draw();
		},

		// Get the single element that was clicked on
		// @return : An object containing the dataset index and element index of the matching element. Also contains the rectangle that was draw
		getElementAtEvent: function(e) {

			var eventPosition = helpers.getRelativePosition(e, this.chart);
			var elementsArray = [];

			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				if (helpers.isDatasetVisible(dataset)) {
					helpers.each(dataset.metaData, function(element, index) {
						if (element.inRange(eventPosition.x, eventPosition.y)) {
							elementsArray.push(element);
							return elementsArray;
						}
					}, this);
				}
			}, this);

			return elementsArray;
		},

		getElementsAtEvent: function(e) {
			var eventPosition = helpers.getRelativePosition(e, this.chart);
			var elementsArray = [];

			var found = (function(){
				for (var i = 0; i < this.data.datasets.length; i++) {
					if (helpers.isDatasetVisible(this.data.datasets[i])) {
						for (var j = 0; j < this.data.datasets[i].metaData.length; j++) {
							if (this.data.datasets[i].metaData[j].inRange(eventPosition.x, eventPosition.y)) {
								return this.data.datasets[i].metaData[j];
							}
						}
					}
				}
			}).call(this);

			if(!found){
				return elementsArray;
			}

			helpers.each(this.data.datasets, function(dataset, dsIndex){
				if(helpers.isDatasetVisible(dataset)){
					elementsArray.push(dataset.metaData[found._index]);
				}
			}, this);

			return elementsArray;
		},

		getDatasetAtEvent: function(e) {
			var eventPosition = helpers.getRelativePosition(e, this.chart);
			var elementsArray = [];

			helpers.each(this.data.datasets, function(dataset, datasetIndex) {
				if (helpers.isDatasetVisible(dataset)) {
					helpers.each(dataset.metaData, function(element, elementIndex) {
						if (element.inLabelRange(eventPosition.x, eventPosition.y)) {
							helpers.each(dataset.metaData, function(element, index) {
								elementsArray.push(element);
							}, this);
						}
					}, this);
				}
			}, this);

			return elementsArray.length ? elementsArray : [];
		},

		generateLegend: function generateLegend() {
			return this.options.legendCallback(this);
		},

		destroy: function destroy() {
			this.clear();
			helpers.unbindEvents(this, this.events);
			helpers.removeResizeListener(this.chart.canvas.parentNode);

			// Reset canvas height/width attributes
			var canvas = this.chart.canvas;
			canvas.width = this.chart.width;
			canvas.height = this.chart.height;

			// if we scaled the canvas in response to a devicePixelRatio !== 1, we need to undo that transform here
			if (this.chart.originalDevicePixelRatio !== undefined) {
				this.chart.ctx.scale(1 / this.chart.originalDevicePixelRatio, 1 / this.chart.originalDevicePixelRatio);
			}

			// Reset to the old style since it may have been changed by the device pixel ratio changes
			canvas.style.width = this.chart.originalCanvasStyleWidth;
			canvas.style.height = this.chart.originalCanvasStyleHeight;

			delete Chart.instances[this.id];
		},

		toBase64Image: function toBase64Image() {
			return this.chart.canvas.toDataURL.apply(this.chart.canvas, arguments);
		},

		initToolTip: function initToolTip() {
			this.tooltip = new Chart.Tooltip({
				_chart: this.chart,
				_data: this.data,
				_options: this.options,
			}, this);
		},

		bindEvents: function bindEvents() {
			helpers.bindEvents(this, this.options.events, function(evt) {
				this.eventHandler(evt);
			});
		},
		eventHandler: function eventHandler(e) {
			this.lastActive = this.lastActive || [];
			this.lastTooltipActive = this.lastTooltipActive || [];

			// Find Active Elements for hover and tooltips
			if (e.type == 'mouseout') {
				this.active = [];
				this.tooltipActive = [];
			} else {
				this.active = function() {
					switch (this.options.hover.mode) {
						case 'single':
							return this.getElementAtEvent(e);
						case 'label':
							return this.getElementsAtEvent(e);
						case 'dataset':
							return this.getDatasetAtEvent(e);
						default:
							return e;
					}
				}.call(this);
				this.tooltipActive = function() {
					switch (this.options.tooltips.mode) {
						case 'single':
							return this.getElementAtEvent(e);
						case 'label':
							return this.getElementsAtEvent(e);
						case 'dataset':
							return this.getDatasetAtEvent(e);
						default:
							return e;
					}
				}.call(this);
			}

			// On Hover hook
			if (this.options.hover.onHover) {
				this.options.hover.onHover.call(this, this.active);
			}

			if (e.type == 'mouseup' || e.type == 'click') {
				if (this.options.onClick) {
					this.options.onClick.call(this, e, this.active);
				}
			}

			var dataset;
			var index;

			// Remove styling for last active (even if it may still be active)
			if (this.lastActive.length) {
				switch (this.options.hover.mode) {
					case 'single':
						this.data.datasets[this.lastActive[0]._datasetIndex].controller.removeHoverStyle(this.lastActive[0], this.lastActive[0]._datasetIndex, this.lastActive[0]._index);
						break;
					case 'label':
					case 'dataset':
						for (var i = 0; i < this.lastActive.length; i++) {
							if (this.lastActive[i])
						  		this.data.datasets[this.lastActive[i]._datasetIndex].controller.removeHoverStyle(this.lastActive[i], this.lastActive[i]._datasetIndex, this.lastActive[i]._index);
						}
						break;
					default:
						// Don't change anything
				}
			}

			// Built in hover styling
			if (this.active.length && this.options.hover.mode) {
				switch (this.options.hover.mode) {
					case 'single':
						this.data.datasets[this.active[0]._datasetIndex].controller.setHoverStyle(this.active[0]);
						break;
					case 'label':
					case 'dataset':
						for (var j = 0; j < this.active.length; j++) {
							if (this.active[j])
				  				this.data.datasets[this.active[j]._datasetIndex].controller.setHoverStyle(this.active[j]);
						}
						break;
					default:
						// Don't change anything
				}
			}


			// Built in Tooltips
			if (this.options.tooltips.enabled || this.options.tooltips.custom) {

				// The usual updates
				this.tooltip.initialize();
				this.tooltip._active = this.tooltipActive;
				this.tooltip.update();
			}

			// Hover animations
			this.tooltip.pivot();

			if (!this.animating) {
				var changed;

				helpers.each(this.active, function(element, index) {
					if (element !== this.lastActive[index]) {
						changed = true;
					}
				}, this);

				helpers.each(this.tooltipActive, function(element, index) {
					if (element !== this.lastTooltipActive[index]) {
						changed = true;
					}
				}, this);

				// If entering, leaving, or changing elements, animate the change via pivot
				if ((this.lastActive.length !== this.active.length) ||
					(this.lastTooltipActive.length !== this.tooltipActive.length) ||
					changed) {

					this.stop();

					if (this.options.tooltips.enabled || this.options.tooltips.custom) {
						this.tooltip.update(true);
					}

					// We only need to render at this point. Updating will cause scales to be recomputed generating flicker & using more
					// memory than necessary.
					this.render(this.options.hover.animationDuration, true);
				}
			}

			// Remember Last Actives
			this.lastActive = this.active;
			this.lastTooltipActive = this.tooltipActive;
			return this;
		},
	});

}).call(this);

(function() {
	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.scale = {
		display: true,

		// grid line settings
		gridLines: {
			show: true,
			color: "rgba(0, 0, 0, 0.1)",
			lineWidth: 1,
			drawOnChartArea: true,
			drawTicks: true,
			zeroLineWidth: 1,
			zeroLineColor: "rgba(0,0,0,0.25)",
			offsetGridLines: false
		},

		// scale label
		scaleLabel: {
			fontColor: '#666',
			fontFamily: 'Helvetica Neue',
			fontSize: 12,
			fontStyle: 'normal',

			// actual label
			labelString: '',

			// display property
			show: false,
		},

		// label settings
		ticks: {
			beginAtZero: false,
			fontSize: 12,
			fontStyle: "normal",
			fontColor: "#666",
			fontFamily: "Helvetica Neue",
			maxRotation: 90,
			minRotation: 20,
			mirror: false,
			// padding: 20,
			reverse: false,
			show: true,
			callback: function(value) {
				return '' + value;
			},
		},
	};

	Chart.Scale = Chart.Element.extend({

		// These methods are ordered by lifecyle. Utilities then follow.
		// Any function defined here is inherited by all scale types.
		// Any function can be extended by the scale type

		beforeUpdate: helpers.noop,
		update: function(maxWidth, maxHeight, margins) {

			// Update Lifecycle - Probably don't want to ever extend or overwrite this function ;)
			this.beforeUpdate();

			// Absorb the master measurements
			this.maxWidth = maxWidth;
			this.maxHeight = maxHeight;
			this.margins = margins;

			// Dimensions
			this.beforeSetDimensions();
			this.setDimensions();
			this.afterSetDimensions();
			// Ticks
			this.beforeBuildTicks();
			this.buildTicks();
			this.afterBuildTicks();

			this.beforeTickToLabelConversion();
			this.convertTicksToLabels();
			this.afterTickToLabelConversion();

			// Tick Rotation
			this.beforeCalculateTickRotation();
			this.calculateTickRotation();
			this.afterCalculateTickRotation();
			// Fit
			this.beforeFit();
			this.fit();
			this.afterFit();
			//
			this.afterUpdate();

			return this.minSize;

		},
		afterUpdate: helpers.noop,

		//

		beforeSetDimensions: helpers.noop,
		setDimensions: function() {
			// Set the unconstrained dimension before label rotation
			if (this.isHorizontal()) {
				// Reset position before calculating rotation
				this.width = this.maxWidth;
				this.left = 0;
				this.right = this.width;
			} else {
				this.height = this.maxHeight;

				// Reset position before calculating rotation
				this.top = 0;
				this.bottom = this.height;
			}

			// Reset padding
			this.paddingLeft = 0;
			this.paddingTop = 0;
			this.paddingRight = 0;
			this.paddingBottom = 0;
		},
		afterSetDimensions: helpers.noop,

		//

		beforeBuildTicks: helpers.noop,
		buildTicks: helpers.noop,
		afterBuildTicks: helpers.noop,

		beforeTickToLabelConversion: helpers.noop,
		convertTicksToLabels: function() {
			// Convert ticks to strings
			this.ticks = this.ticks.map(function(numericalTick, index, ticks) {
					if (this.options.ticks.userCallback) {
						return this.options.ticks.userCallback(numericalTick, index, ticks);
					}
					return this.options.ticks.callback(numericalTick, index, ticks);
				},
				this);
		},
		afterTickToLabelConversion: helpers.noop,

		//

		beforeCalculateTickRotation: helpers.noop,
		calculateTickRotation: function() {
			//Get the width of each grid by calculating the difference
			//between x offsets between 0 and 1.
			var labelFont = helpers.fontString(this.options.ticks.fontSize, this.options.ticks.fontStyle, this.options.ticks.fontFamily);
			this.ctx.font = labelFont;

			var firstWidth = this.ctx.measureText(this.ticks[0]).width;
			var lastWidth = this.ctx.measureText(this.ticks[this.ticks.length - 1]).width;
			var firstRotated;
			var lastRotated;

			this.paddingRight = lastWidth / 2 + 3;
			this.paddingLeft = firstWidth / 2 + 3;

			this.labelRotation = 0;

			if (this.options.display && this.isHorizontal()) {
				var originalLabelWidth = helpers.longestText(this.ctx, labelFont, this.ticks);
				var cosRotation;
				var sinRotation;
				var firstRotatedWidth;

				this.labelWidth = originalLabelWidth;

				// Allow 3 pixels x2 padding either side for label readability
				// only the index matters for a dataset scale, but we want a consistent interface between scales

				var tickWidth = this.getPixelForTick(1) - this.getPixelForTick(0) - 6;

				//Max label rotation can be set or default to 90 - also act as a loop counter
				while (this.labelWidth > tickWidth && this.labelRotation <= this.options.ticks.maxRotation) {
					cosRotation = Math.cos(helpers.toRadians(this.labelRotation));
					sinRotation = Math.sin(helpers.toRadians(this.labelRotation));

					firstRotated = cosRotation * firstWidth;
					lastRotated = cosRotation * lastWidth;

					// We're right aligning the text now.
					if (firstRotated + this.options.ticks.fontSize / 2 > this.yLabelWidth) {
						this.paddingLeft = firstRotated + this.options.ticks.fontSize / 2;
					}

					this.paddingRight = this.options.ticks.fontSize / 2;

					if (sinRotation * originalLabelWidth > this.maxHeight) {
						// go back one step
						this.labelRotation--;
						break;
					}

					this.labelRotation++;
					this.labelWidth = cosRotation * originalLabelWidth;

				}
			} else {
				this.labelWidth = 0;
				this.paddingRight = 0;
				this.paddingLeft = 0;
			}

			if (this.margins) {
				this.paddingLeft -= this.margins.left;
				this.paddingRight -= this.margins.right;

				this.paddingLeft = Math.max(this.paddingLeft, 0);
				this.paddingRight = Math.max(this.paddingRight, 0);
			}
		},
		afterCalculateTickRotation: helpers.noop,

		//

		beforeFit: helpers.noop,
		fit: function() {

			this.minSize = {
				width: 0,
				height: 0,
			};

			// Width
			if (this.isHorizontal()) {
				this.minSize.width = this.maxWidth; // fill all the width
			} else {
				this.minSize.width = this.options.gridLines.show && this.options.display ? 10 : 0;
			}

			// height
			if (this.isHorizontal()) {
				this.minSize.height = this.options.gridLines.show && this.options.display ? 10 : 0;
			} else {
				this.minSize.height = this.maxHeight; // fill all the height
			}

			// Are we showing a title for the scale?
			if (this.options.scaleLabel.show) {
				if (this.isHorizontal()) {
					this.minSize.height += (this.options.scaleLabel.fontSize * 1.5);
				} else {
					this.minSize.width += (this.options.scaleLabel.fontSize * 1.5);
				}
			}

			if (this.options.ticks.show && this.options.display) {
				// Don't bother fitting the ticks if we are not showing them
				var labelFont = helpers.fontString(this.options.ticks.fontSize,
					this.options.ticks.fontStyle, this.options.ticks.fontFamily);

				if (this.isHorizontal()) {
					// A horizontal axis is more constrained by the height.
					var maxLabelHeight = this.maxHeight - this.minSize.height;
					var longestLabelWidth = helpers.longestText(this.ctx, labelFont, this.ticks);

					// TODO - improve this calculation
					var labelHeight = (Math.sin(helpers.toRadians(this.labelRotation)) * longestLabelWidth) + 1.5 * this.options.ticks.fontSize;

					this.minSize.height = Math.min(this.maxHeight, this.minSize.height + labelHeight);

					labelFont = helpers.fontString(this.options.ticks.fontSize, this.options.ticks.fontStyle, this.options.ticks.fontFamily);
					this.ctx.font = labelFont;

					var firstLabelWidth = this.ctx.measureText(this.ticks[0]).width;
					var lastLabelWidth = this.ctx.measureText(this.ticks[this.ticks.length - 1]).width;

					// Ensure that our ticks are always inside the canvas. When rotated, ticks are right aligned which means that the right padding is dominated
					// by the font height
					var cosRotation = Math.cos(helpers.toRadians(this.labelRotation));
					var sinRotation = Math.sin(helpers.toRadians(this.labelRotation));
					this.paddingLeft = this.labelRotation !== 0 ? (cosRotation * firstLabelWidth) + 3 : firstLabelWidth / 2 + 3; // add 3 px to move away from canvas edges
					this.paddingRight = lastLabelWidth / 2 + 4;
					// this.paddingRight = this.labelRotation !== 0 ? (sinRotation * (this.options.ticks.fontSize / 2)) + 3 : lastLabelWidth / 2 + 3; // when rotated
				} else {
					// A vertical axis is more constrained by the width. Labels are the dominant factor here, so get that length first
					var maxLabelWidth = this.maxWidth - this.minSize.width;
					var largestTextWidth = helpers.longestText(this.ctx, labelFont, this.ticks);

					// Account for padding
					if (!this.options.ticks.mirror) {
						largestTextWidth += this.options.ticks.padding;
					}

					if (largestTextWidth < maxLabelWidth) {
						// We don't need all the room
						this.minSize.width += largestTextWidth;
					} else {
						// Expand to max size
						this.minSize.width = this.maxWidth;
					}

					this.paddingTop = this.options.ticks.fontSize / 2;
					this.paddingBottom = this.options.ticks.fontSize / 2;
				}
			}

			if (this.margins) {
				this.paddingLeft -= this.margins.left;
				this.paddingTop -= this.margins.top;
				this.paddingRight -= this.margins.right;
				this.paddingBottom -= this.margins.bottom;

				this.paddingLeft = Math.max(this.paddingLeft, 0);
				this.paddingTop = Math.max(this.paddingTop, 0);
				this.paddingRight = Math.max(this.paddingRight, 0);
				this.paddingBottom = Math.max(this.paddingBottom, 0);
			}

			this.width = this.minSize.width;
			this.height = this.minSize.height;

		},
		afterFit: helpers.noop,

		// Shared Methods
		isHorizontal: function() {
			return this.options.position == "top" || this.options.position == "bottom";
		},

		// Get the correct value. NaN bad inputs, If the value type is object get the x or y based on whether we are horizontal or not
		getRightValue: function getRightValue(rawValue) {
			// Null and undefined values first
			if (rawValue === null || typeof(rawValue) === 'undefined') {
				return NaN;
			}
			// isNaN(object) returns true, so make sure NaN is checking for a number
			if (typeof(rawValue) === 'number' && isNaN(rawValue)) {
				return NaN;
			}
			// If it is in fact an object, dive in one more level
			if (typeof(rawValue) === "object") {
				return getRightValue(this.isHorizontal() ? rawValue.x : rawValue.y);
			}

			// Value is good, return it
			return rawValue;
		},

		// Used to get the value to display in the tooltip for the data at the given index
		// function getLabelForIndex(index, datasetIndex)
		getLabelForIndex: helpers.noop,

		// Used to get data value locations.  Value can either be an index or a numerical value
		getPixelForValue: helpers.noop,

		// Used for tick location, should
		getPixelForTick: function(index, includeOffset) {
			if (this.isHorizontal()) {
				var innerWidth = this.width - (this.paddingLeft + this.paddingRight);
				var tickWidth = innerWidth / Math.max((this.ticks.length - ((this.options.gridLines.offsetGridLines) ? 0 : 1)), 1);
				var pixel = (tickWidth * index) + this.paddingLeft;

				if (includeOffset) {
					pixel += tickWidth / 2;
				}
				return this.left + Math.round(pixel);
			} else {
				var innerHeight = this.height - (this.paddingTop + this.paddingBottom);
				return this.top + (index * (innerHeight / (this.ticks.length - 1)));
			}
		},

		// Utility for getting the pixel location of a percentage of scale
		getPixelForDecimal: function(decimal, includeOffset) {
			if (this.isHorizontal()) {
				var innerWidth = this.width - (this.paddingLeft + this.paddingRight);
				var valueOffset = (innerWidth * decimal) + this.paddingLeft;

				return this.left + Math.round(valueOffset);
			} else {
				return this.top + (decimal * this.height);
			}
		},

		// Actualy draw the scale on the canvas
		// @param {rectangle} chartArea : the area of the chart to draw full grid lines on
		draw: function(chartArea) {
			if (this.options.display) {

				var setContextLineSettings;
				var isRotated = false;
				var skipRatio;
				var scaleLabelX;
				var scaleLabelY;

				// Make sure we draw text in the correct color and font
				this.ctx.fillStyle = this.options.ticks.fontColor;
				var labelFont = helpers.fontString(this.options.ticks.fontSize, this.options.ticks.fontStyle, this.options.ticks.fontFamily);

				if (this.isHorizontal()) { // X 轴
					setContextLineSettings = true;
					var yTickStart = this.options.position == "bottom" ? this.top : this.bottom - 5;
					var yTickEnd = this.options.position == "bottom" ? this.top + 5 : this.bottom;
					skipRatio = false;

					if ((this.options.ticks.fontSize + 4) * this.ticks.length > (this.width - (this.paddingLeft + this.paddingRight))) {
						skipRatio = 1 + Math.floor(((this.options.ticks.fontSize + 4) * this.ticks.length) / (this.width - (this.paddingLeft + this.paddingRight)));
					}
					// 能展示的最多ticks数
					var textWidth = this.ctx.measureText(this.ticks[0]).width;
					// 总长度减去text占用的长度
					var canDisplay = Math.floor((this.width + (textWidth)) / (textWidth * 1.4));

					// canDisplay++;
					// var canDisplay = 4;
					// console.log(canDisplay);
					canDisplay = Math.min(canDisplay, this.ticks.length);

					var showTickStep = Math.ceil((this.ticks.length - 1) / (canDisplay - 1));

					helpers.each(this.ticks, function(label, index) {

						// Blank ticks
						// if ((skipRatio > 1 && index % skipRatio > 0) || (label === undefined || label === null)) {
						// 	return;
						// }
						// 与X轴垂直的线
						var xLineValue = this.getPixelForTick(index); // xvalues for grid lines
						// X轴上的Label
						// var xLabelValue = this.getPixelForTick(index, this.options.gridLines.offsetGridLines); // x values for ticks (need to consider offsetLabel option)
						var xLabelValue = xLineValue;

						//xLabelValue += (this.ticks.fontSize / 2);

						var showLineFlag = (index % showTickStep) == 0;
						var showLableFlag = showLineFlag;
						// 是否最后一个Tick
						if ( Math.ceil(index / showTickStep) >= canDisplay) {
							if((this.left + this.width  - xLineValue) < (textWidth / 2)) {
								showLableFlag = false;
							}
						}
						if (this.options.gridLines.show) {
							if (index === (typeof this.zeroLineIndex !== 'undefined' ? this.zeroLineIndex : 0)) {
								// Draw the first index specially
								this.ctx.lineWidth = this.options.gridLines.zeroLineWidth;
								this.ctx.strokeStyle = this.options.gridLines.zeroLineColor;
								setContextLineSettings = true; // reset next time
							} else if (setContextLineSettings) {
								this.ctx.lineWidth = this.options.gridLines.lineWidth;
								this.ctx.strokeStyle = this.options.gridLines.color;
								setContextLineSettings = false;
							}

							xLineValue += helpers.aliasPixel(this.ctx.lineWidth);

							// Draw the label area
							this.ctx.beginPath();

							if (this.options.gridLines.drawTicks && showLableFlag) {
								this.ctx.moveTo(xLineValue, yTickStart);
								this.ctx.lineTo(xLineValue, yTickEnd);
							}
							var lastGridLine = (index === this.ticks.length - 1);
							// Draw the chart area
							if ((this.options.gridLines.drawOnChartArea  && showLineFlag) || lastGridLine) {
								this.ctx.moveTo(xLineValue, chartArea.top);
								this.ctx.lineTo(xLineValue, chartArea.bottom);
							}

							// Need to stroke in the loop because we are potentially changing line widths & colours
							this.ctx.stroke();
						}
						if (this.options.ticks.show  && showLableFlag) {
							this.ctx.save();
							this.ctx.translate(xLabelValue, (isRotated) ? this.top + 12 : this.options.position === "top" ? this.bottom - 10 : this.top + 10);
							// this.ctx.rotate(helpers.toRadians(this.labelRotation) * -1);
							this.ctx.font = labelFont;
							this.ctx.textAlign = (isRotated) ? "right" : "center";
							this.ctx.textBaseline = (isRotated) ? "middle" : this.options.position === "top" ? "bottom" : "top";
							this.ctx.fillText(label, 0, 0);
							this.ctx.restore();
						}
					}, this);

					if (this.options.scaleLabel.show && showLableFlag) {
						// Draw the scale label
						this.ctx.textAlign = "center";
						this.ctx.textBaseline = 'middle';
						this.ctx.fillStyle = this.options.scaleLabel.fontColor; // render in correct colour
						this.ctx.font = helpers.fontString(this.options.scaleLabel.fontSize, this.options.scaleLabel.fontStyle, this.options.scaleLabel.fontFamily);

						scaleLabelX = this.left + ((this.right - this.left) / 2); // midpoint of the width
						scaleLabelY = this.options.position == 'bottom' ? this.bottom - (this.options.scaleLabel.fontSize / 2) : this.top + (this.options.scaleLabel.fontSize / 2);

						this.ctx.fillText(this.options.scaleLabel.labelString, scaleLabelX, scaleLabelY);
					}

				} else {   // Y轴
					setContextLineSettings = true;
					var xTickStart = this.options.position == "right" ? this.left : this.right - 5;
					var xTickEnd = this.options.position == "right" ? this.left + 5 : this.right;

					helpers.each(this.ticks, function(label, index) {
						// If the callback returned a null or undefined value, do not draw this line
						if (label === undefined || label === null) {
							return;
						}

						var yLineValue = this.getPixelForTick(index); // xvalues for grid lines

						if (this.options.gridLines.show) {
							if (index === (typeof this.zeroLineIndex !== 'undefined' ? this.zeroLineIndex : 0)) {
								// Draw the first index specially
								this.ctx.lineWidth = this.options.gridLines.zeroLineWidth;
								this.ctx.strokeStyle = this.options.gridLines.zeroLineColor;
								setContextLineSettings = true; // reset next time
							} else if (setContextLineSettings) {
								this.ctx.lineWidth = this.options.gridLines.lineWidth;
								this.ctx.strokeStyle = this.options.gridLines.color;
								setContextLineSettings = false;
							}

							yLineValue += helpers.aliasPixel(this.ctx.lineWidth);

							// Draw the label area
							this.ctx.beginPath();

							// if (this.options.gridLines.drawTicks) {
							// 	this.ctx.moveTo(xTickStart, yLineValue);
							// 	this.ctx.lineTo(xTickEnd, yLineValue);
							// }

							// Draw the chart area
							if (this.options.gridLines.drawOnChartArea) {
								this.ctx.moveTo(chartArea.left, yLineValue);
								this.ctx.lineTo(chartArea.right, yLineValue);
							}

							// Need to stroke in the loop because we are potentially changing line widths & colours
							this.ctx.stroke();
						}

						if (this.options.ticks.show) {
							var xLabelValue;
							var yLabelValue = this.getPixelForTick(index, this.options.gridLines.offsetGridLines); // x values for ticks (need to consider offsetLabel option)

							this.ctx.save();

							if (this.options.position == "left") {
								if (this.options.ticks.mirror) {
									xLabelValue = this.right + this.options.ticks.padding;
									this.ctx.textAlign = "left";
								} else {
									xLabelValue = this.right - this.options.ticks.padding;
									this.ctx.textAlign = "right";
								}
							} else {
								// right side
								if (this.options.ticks.mirror) {
									xLabelValue = this.left - this.options.ticks.padding;
									this.ctx.textAlign = "right";
								} else {
									xLabelValue = this.left + this.options.ticks.padding;
									this.ctx.textAlign = "left";
								}
							}

							// Y轴的坐标加下移2px
							this.ctx.translate(xLabelValue, yLabelValue + 2);
							this.ctx.rotate(helpers.toRadians(this.labelRotation) * -1);
							this.ctx.font = labelFont;
							this.ctx.textBaseline = "middle";
							this.ctx.fillText(label, 0, 0);
							this.ctx.restore();
						}
					}, this);

					if (this.options.scaleLabel.show) {
						// Draw the scale label
						scaleLabelX = this.options.position == 'left' ? this.left + (this.options.scaleLabel.fontSize / 2) : this.right - (this.options.scaleLabel.fontSize / 2);
						scaleLabelY = this.top + ((this.bottom - this.top) / 2);
						var rotation = this.options.position == 'left' ? -0.5 * Math.PI : 0.5 * Math.PI;

						this.ctx.save();
						this.ctx.translate(scaleLabelX, scaleLabelY);
						this.ctx.rotate(rotation);
						this.ctx.textAlign = "center";
						this.ctx.fillStyle = this.options.scaleLabel.fontColor; // render in correct colour
						this.ctx.font = helpers.fontString(this.options.scaleLabel.fontSize, this.options.scaleLabel.fontStyle, this.options.scaleLabel.fontFamily);
						this.ctx.textBaseline = 'middle';
						this.ctx.fillText(this.options.scaleLabel.labelString, 0, 0);
						this.ctx.restore();
					}
				}
			}
		}
	});

}).call(this);

(function() {
	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	// The scale service is used to resize charts along with all of their axes. We make this as
	// a service where scales are registered with their respective charts so that changing the
	// scales does not require
	Chart.scaleService = {
		// Scale registration object. Extensions can register new scale types (such as log or DB scales) and then
		// use the new chart options to grab the correct scale
		constructors: {},
		// Use a registration function so that we can move to an ES6 map when we no longer need to support
		// old browsers

		// Scale config defaults
		defaults: {},
		registerScaleType: function(type, scaleConstructor, defaults) {
			this.constructors[type] = scaleConstructor;
			this.defaults[type] = helpers.clone(defaults);
		},
		getScaleConstructor: function(type) {
			return this.constructors.hasOwnProperty(type) ? this.constructors[type] : undefined;
		},
		getScaleDefaults: function(type) {
			// Return the scale defaults merged with the global settings so that we always use the latest ones
			return this.defaults.hasOwnProperty(type) ? helpers.scaleMerge(Chart.defaults.scale, this.defaults[type]) : {};
		},
		// The interesting function
		update: function(chartInstance, width, height) {
			var xPadding = width > 30 ? 5 : 2;
			var yPadding = height > 30 ? 5 : 2;

			if (chartInstance) {
				var leftScales = helpers.where(chartInstance.scales, function(scaleInstance) {
					return scaleInstance.options.position == "left";
				});
				var rightScales = helpers.where(chartInstance.scales, function(scaleInstance) {
					return scaleInstance.options.position == "right";
				});
				var topScales = helpers.where(chartInstance.scales, function(scaleInstance) {
					return scaleInstance.options.position == "top";
				});
				var bottomScales = helpers.where(chartInstance.scales, function(scaleInstance) {
					return scaleInstance.options.position == "bottom";
				});

				// Scales that overlay the chartarea such as the radialLinear scale
				var chartAreaScales = helpers.where(chartInstance.scales, function(scaleInstance) {
					return scaleInstance.options.position == "chartArea";
				});

				// Essentially we now have any number of scales on each of the 4 sides.
				// Our canvas looks like the following.
				// The areas L1 and L2 are the left axes. R1 is the right axis, T1 is the top axis and
				// B1 is the bottom axis
				// |------------------------------------------------------|
				// |          |             T1                      |     |
				// |----|-----|-------------------------------------|-----|
				// |    |     |                                     |     |
				// | L1 |  L2 |         Chart area                  |  R1 |
				// |    |     |                                     |     |
				// |    |     |                                     |     |
				// |----|-----|-------------------------------------|-----|
				// |          |             B1                      |     |
				// |          |                                     |     |
				// |------------------------------------------------------|

				// What we do to find the best sizing, we do the following
				// 1. Determine the minimum size of the chart area.
				// 2. Split the remaining width equally between each vertical axis
				// 3. Split the remaining height equally between each horizontal axis
				// 4. Give each scale the maximum size it can be. The scale will return it's minimum size
				// 5. Adjust the sizes of each axis based on it's minimum reported size.
				// 6. Refit each axis
				// 7. Position each axis in the final location
				// 8. Tell the chart the final location of the chart area
				// 9. Tell any axes that overlay the chart area the positions of the chart area

				// Step 1
				var chartWidth = width / 2; // min 50%
				var chartHeight = height / 2; // min 50%

				chartWidth -= (2 * xPadding);
				chartHeight -= (2 * yPadding);

				// Step 2
				var verticalScaleWidth = (width - chartWidth) / (leftScales.length + rightScales.length);

				// Step 3
				var horizontalScaleHeight = (height - chartHeight) / (topScales.length + bottomScales.length);

				// Step 4;
				var minimumScaleSizes = [];

				var verticalScaleMinSizeFunction = function(scaleInstance) {
					var minSize = scaleInstance.update(verticalScaleWidth, chartHeight);
					minimumScaleSizes.push({
						horizontal: false,
						minSize: minSize,
						scale: scaleInstance,
					});
				};

				var horizontalScaleMinSizeFunction = function(scaleInstance) {
					var minSize = scaleInstance.update(chartWidth, horizontalScaleHeight);
					minimumScaleSizes.push({
						horizontal: true,
						minSize: minSize,
						scale: scaleInstance,
					});
				};

				// vertical scales
				helpers.each(leftScales, verticalScaleMinSizeFunction);
				helpers.each(rightScales, verticalScaleMinSizeFunction);

				// horizontal scales
				helpers.each(topScales, horizontalScaleMinSizeFunction);
				helpers.each(bottomScales, horizontalScaleMinSizeFunction);

				// Step 5
				var maxChartHeight = height - (2 * yPadding);
				var maxChartWidth = width - (2 * xPadding);

				helpers.each(minimumScaleSizes, function(wrapper) {
					if (wrapper.horizontal) {
						maxChartHeight -= wrapper.minSize.height;
					} else {
						maxChartWidth -= wrapper.minSize.width;
					}
				});

				// At this point, maxChartHeight and maxChartWidth are the size the chart area could
				// be if the axes are drawn at their minimum sizes.

				// Step 6
				var verticalScaleFitFunction = function(scaleInstance) {
					var wrapper = helpers.findNextWhere(minimumScaleSizes, function(wrapper) {
						return wrapper.scale === scaleInstance;
					});

					if (wrapper) {
						scaleInstance.update(wrapper.minSize.width, maxChartHeight);
					}
				};

				var horizontalScaleFitFunction = function(scaleInstance) {
					var wrapper = helpers.findNextWhere(minimumScaleSizes, function(wrapper) {
						return wrapper.scale === scaleInstance;
					});

					var scaleMargin = {
						left: totalLeftWidth,
						right: totalRightWidth,
						top: 0,
						bottom: 0,
					};

					if (wrapper) {
						scaleInstance.update(maxChartWidth, wrapper.minSize.height, scaleMargin);
					}
				};

				var totalLeftWidth = xPadding;
				var totalRightWidth = xPadding;
				var totalTopHeight = yPadding;
				var totalBottomHeight = yPadding;

				helpers.each(leftScales, verticalScaleFitFunction);
				helpers.each(rightScales, verticalScaleFitFunction);

				// Figure out how much margin is on the left and right of the horizontal axes
				helpers.each(leftScales, function(scaleInstance) {
					totalLeftWidth += scaleInstance.width;
				});

				helpers.each(rightScales, function(scaleInstance) {
					totalRightWidth += scaleInstance.width;
				});

				helpers.each(topScales, horizontalScaleFitFunction);
				helpers.each(bottomScales, horizontalScaleFitFunction);

				helpers.each(topScales, function(scaleInstance) {
					totalTopHeight += scaleInstance.height;
				});
				helpers.each(bottomScales, function(scaleInstance) {
					totalBottomHeight += scaleInstance.height;
				});

				// Let the left scale know the final margin
				helpers.each(leftScales, function(scaleInstance) {
					var wrapper = helpers.findNextWhere(minimumScaleSizes, function(wrapper) {
						return wrapper.scale === scaleInstance;
					});

					var scaleMargin = {
						left: 0,
						right: 0,
						top: totalTopHeight,
						bottom: totalBottomHeight
					};

					if (wrapper) {
						scaleInstance.update(wrapper.minSize.width, maxChartHeight, scaleMargin);
					}
				});

				helpers.each(rightScales, function(scaleInstance) {
					var wrapper = helpers.findNextWhere(minimumScaleSizes, function(wrapper) {
						return wrapper.scale === scaleInstance;
					});

					var scaleMargin = {
						left: 0,
						right: 0,
						top: totalTopHeight,
						bottom: totalBottomHeight
					};

					if (wrapper) {
						scaleInstance.update(wrapper.minSize.width, maxChartHeight, scaleMargin);
					}
				});

				// Recalculate because the size of each scale might have changed slightly due to the margins (label rotation for instance)
				totalLeftWidth = xPadding;
				totalRightWidth = xPadding;
				totalTopHeight = yPadding;
				totalBottomHeight = yPadding;

				helpers.each(leftScales, function(scaleInstance) {
					totalLeftWidth += scaleInstance.width;
				});

				helpers.each(rightScales, function(scaleInstance) {
					totalRightWidth += scaleInstance.width;
				});

				helpers.each(topScales, function(scaleInstance) {
					totalTopHeight += scaleInstance.height;
				});
				helpers.each(bottomScales, function(scaleInstance) {
					totalBottomHeight += scaleInstance.height;
				});

				// Figure out if our chart area changed. This would occur if the dataset scale label rotation
				// changed due to the application of the margins in step 6. Since we can only get bigger, this is safe to do
				// without calling `fit` again
				var newMaxChartHeight = height - totalTopHeight - totalBottomHeight;
				var newMaxChartWidth = width - totalLeftWidth - totalRightWidth;

				if (newMaxChartWidth !== maxChartWidth || newMaxChartHeight !== maxChartHeight) {
					helpers.each(leftScales, function(scale) {
						scale.height = newMaxChartHeight;
					});

					helpers.each(rightScales, function(scale) {
						scale.height = newMaxChartHeight;
					});

					helpers.each(topScales, function(scale) {
						scale.width = newMaxChartWidth;
					});

					helpers.each(bottomScales, function(scale) {
						scale.width = newMaxChartWidth;
					});

					maxChartHeight = newMaxChartHeight;
					maxChartWidth = newMaxChartWidth;
				}

				// Step 7
				// Position the scales
				var left = xPadding;
				var top = yPadding;
				var right = 0;
				var bottom = 0;

				var verticalScalePlacer = function(scaleInstance) {
					scaleInstance.left = left;
					scaleInstance.right = left + scaleInstance.width;
					scaleInstance.top = totalTopHeight;
					scaleInstance.bottom = totalTopHeight + maxChartHeight;

					// Move to next point
					left = scaleInstance.right;
				};

				var horizontalScalePlacer = function(scaleInstance) {
					scaleInstance.left = totalLeftWidth;
					scaleInstance.right = totalLeftWidth + maxChartWidth;
					scaleInstance.top = top;
					scaleInstance.bottom = top + scaleInstance.height;

					// Move to next point
					top = scaleInstance.bottom;
				};

				helpers.each(leftScales, verticalScalePlacer);
				helpers.each(topScales, horizontalScalePlacer);

				// Account for chart width and height
				left += maxChartWidth;
				top += maxChartHeight;

				helpers.each(rightScales, verticalScalePlacer);
				helpers.each(bottomScales, horizontalScalePlacer);

				// Step 8
				chartInstance.chartArea = {
					left: totalLeftWidth,
					top: totalTopHeight,
					right: totalLeftWidth + maxChartWidth,
					bottom: totalTopHeight + maxChartHeight,
				};

				// Step 9
				helpers.each(chartAreaScales, function(scaleInstance) {
					scaleInstance.left = chartInstance.chartArea.left;
					scaleInstance.top = chartInstance.chartArea.top;
					scaleInstance.right = chartInstance.chartArea.right;
					scaleInstance.bottom = chartInstance.chartArea.bottom;

					scaleInstance.update(maxChartWidth, maxChartHeight);
				});
			}
		}
	};


}).call(this);

(function() {

	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.global.animation = {
		duration: 300,
		easing: "easeOutQuart",
		onProgress: function() {},
		onComplete: function() {},
	};

	Chart.Animation = Chart.Element.extend({
		currentStep: null, // the current animation step
		numSteps: 60, // default number of steps
		easing: "", // the easing to use for this animation
		render: null, // render function used by the animation service

		onAnimationProgress: null, // user specified callback to fire on each step of the animation
		onAnimationComplete: null, // user specified callback to fire when the animation finishes
	});

	Chart.animationService = {
		frameDuration: 17,
		animations: [],
		dropFrames: 0,
		addAnimation: function(chartInstance, animationObject, duration, lazy) {

			if (!lazy) {
				chartInstance.animating = true;
			}

			for (var index = 0; index < this.animations.length; ++index) {
				if (this.animations[index].chartInstance === chartInstance) {
					// replacing an in progress animation
					this.animations[index].animationObject = animationObject;
					return;
				}
			}

			this.animations.push({
				chartInstance: chartInstance,
				animationObject: animationObject
			});

			// If there are no animations queued, manually kickstart a digest, for lack of a better word
			if (this.animations.length == 1) {
				helpers.requestAnimFrame.call(window, this.digestWrapper);
			}
		},
		// Cancel the animation for a given chart instance
		cancelAnimation: function(chartInstance) {
			var index = helpers.findNextWhere(this.animations, function(animationWrapper) {
				return animationWrapper.chartInstance === chartInstance;
			});

			if (index) {
				this.animations.splice(index, 1);
				chartInstance.animating = false;
			}
		},
		// calls startDigest with the proper context
		digestWrapper: function() {
			Chart.animationService.startDigest.call(Chart.animationService);
		},
		startDigest: function() {

			var startTime = Date.now();
			var framesToDrop = 0;

			if (this.dropFrames > 1) {
				framesToDrop = Math.floor(this.dropFrames);
				this.dropFrames = this.dropFrames % 1;
			}

			for (var i = 0; i < this.animations.length; i++) {

				if (this.animations[i].animationObject.currentStep === null) {
					this.animations[i].animationObject.currentStep = 0;
				}
				this.animations[i].animationObject.currentStep += 1 + framesToDrop;
				if (this.animations[i].animationObject.currentStep > this.animations[i].animationObject.numSteps) {
					this.animations[i].animationObject.currentStep = this.animations[i].animationObject.numSteps;
				}

				this.animations[i].animationObject.render(this.animations[i].chartInstance, this.animations[i].animationObject);

				if (this.animations[i].animationObject.currentStep == this.animations[i].animationObject.numSteps) {
					// executed the last frame. Remove the animation.
					this.animations[i].chartInstance.animating = false;
					this.animations.splice(i, 1);
					// Keep the index in place to offset the splice
					i--;
				}
			}

			var endTime = Date.now();
			var dropFrames = (endTime - startTime) / this.frameDuration;

			this.dropFrames += dropFrames;

			// Do we have more stuff to animate?
			if (this.animations.length > 0) {
				helpers.requestAnimFrame.call(window, this.digestWrapper);
			}
		}
	};

}).call(this);

(function() {

	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.global.tooltips = {
		enabled: true,
		custom: null,
		mode: 'single',
		backgroundColor: "rgba(0,0,0,0.8)",
		titleFontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
		titleFontSize: 12,
		titleFontStyle: "bold",
		titleSpacing: 2,
		titleMarginBottom: 6,
		titleColor: "#fff",
		titleAlign: "left",
		bodyFontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
		bodyFontSize: 12,
		bodyFontStyle: "normal",
		bodySpacing: 2,
		bodyColor: "#fff",
		bodyAlign: "left",
		footerFontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
		footerFontSize: 12,
		footerFontStyle: "bold",
		footerSpacing: 2,
		footerMarginTop: 6,
		footerColor: "#fff",
		footerAlign: "left",
		yPadding: 6,
		xPadding: 6,
		caretSize: 5,
		cornerRadius: 6,
		xOffset: 10,
		multiKeyBackground: '#fff',
		callbacks: {
			// Args are: (tooltipItems, data)
			beforeTitle: helpers.noop,
			title: function(tooltipItems, data) {
				// Pick first xLabel for now
				var title = '';

				if (tooltipItems.length > 0) {
					if (tooltipItems[0].xLabel) {
						title = tooltipItems[0].xLabel;
					} else if (data.labels.length > 0 && tooltipItems[0].index < data.labels.length) {
						title = data.labels[tooltipItems[0].index];
					}
				}

				return title;
			},
			afterTitle: helpers.noop,

			// Args are: (tooltipItems, data)
			beforeBody: helpers.noop,

			// Args are: (tooltipItem, data)
			beforeLabel: helpers.noop,
			label: function(tooltipItem, data) {
				var datasetLabel = data.datasets[tooltipItem.datasetIndex].label || '';
				return datasetLabel + ': ' + tooltipItem.yLabel;
			},
			afterLabel: helpers.noop,

			// Args are: (tooltipItems, data)
			afterBody: helpers.noop,

			// Args are: (tooltipItems, data)
			beforeFooter: helpers.noop,
			footer: helpers.noop,
			afterFooter: helpers.noop,
		},
	};

	// Helper to push or concat based on if the 2nd parameter is an array or not
	function pushOrConcat(base, toPush) {
		if (toPush) {
			if (helpers.isArray(toPush)) {
				base = base.concat(toPush);
			} else {
				base.push(toPush);
			}
		}

		return base;
	}

	Chart.Tooltip = Chart.Element.extend({
		initialize: function() {
			var options = this._options;
			helpers.extend(this, {
				_model: {
					// Positioning
					xPadding: options.tooltips.xPadding,
					yPadding: options.tooltips.yPadding,
					xOffset: options.tooltips.xOffset,

					// Body
					bodyColor: options.tooltips.bodyColor,
					_bodyFontFamily: options.tooltips.bodyFontFamily,
					_bodyFontStyle: options.tooltips.bodyFontStyle,
					_bodyAlign: options.tooltips.bodyAlign,
					bodyFontSize: options.tooltips.bodyFontSize,
					bodySpacing: options.tooltips.bodySpacing,

					// Title
					titleColor: options.tooltips.titleColor,
					_titleFontFamily: options.tooltips.titleFontFamily,
					_titleFontStyle: options.tooltips.titleFontStyle,
					titleFontSize: options.tooltips.titleFontSize,
					_titleAlign: options.tooltips.titleAlign,
					titleSpacing: options.tooltips.titleSpacing,
					titleMarginBottom: options.tooltips.titleMarginBottom,

					// Footer
					footerColor: options.tooltips.footerColor,
					_footerFontFamily: options.tooltips.footerFontFamily,
					_footerFontStyle: options.tooltips.footerFontStyle,
					footerFontSize: options.tooltips.footerFontSize,
					_footerAlign: options.tooltips.footerAlign,
					footerSpacing: options.tooltips.footerSpacing,
					footerMarginTop: options.tooltips.footerMarginTop,

					// Appearance
					caretSize: options.tooltips.caretSize,
					cornerRadius: options.tooltips.cornerRadius,
					backgroundColor: options.tooltips.backgroundColor,
					opacity: 0,
					legendColorBackground: options.tooltips.multiKeyBackground,
				},
			});
		},

		// Get the title
		// Args are: (tooltipItem, data)
		getTitle: function() {
			var beforeTitle = this._options.tooltips.callbacks.beforeTitle.apply(this, arguments),
				title = this._options.tooltips.callbacks.title.apply(this, arguments),
				afterTitle = this._options.tooltips.callbacks.afterTitle.apply(this, arguments);

			var lines = [];
			lines = pushOrConcat(lines, beforeTitle);
			lines = pushOrConcat(lines, title);
			lines = pushOrConcat(lines, afterTitle);

			return lines;
		},

		// Args are: (tooltipItem, data)
		getBeforeBody: function() {
			var lines = this._options.tooltips.callbacks.beforeBody.call(this, arguments);
			return helpers.isArray(lines) ? lines : [lines];
		},

		// Args are: (tooltipItem, data)
		getBody: function(tooltipItems, data) {
			var lines = [];

			helpers.each(tooltipItems, function(bodyItem) {
				var beforeLabel = this._options.tooltips.callbacks.beforeLabel.call(this, bodyItem, data) || '';
				var bodyLabel = this._options.tooltips.callbacks.label.call(this, bodyItem, data) || '';
				var afterLabel = this._options.tooltips.callbacks.afterLabel.call(this, bodyItem, data) || '';

				lines.push(beforeLabel + bodyLabel + afterLabel);
			}, this);

			return lines;
		},

		// Args are: (tooltipItem, data)
		getAfterBody: function() {
			var lines = this._options.tooltips.callbacks.afterBody.call(this, arguments);
			return helpers.isArray(lines) ? lines : [lines];
		},

		// Get the footer and beforeFooter and afterFooter lines
		// Args are: (tooltipItem, data)
		getFooter: function() {
			var beforeFooter = this._options.tooltips.callbacks.beforeFooter.apply(this, arguments);
			var footer = this._options.tooltips.callbacks.footer.apply(this, arguments);
			var afterFooter = this._options.tooltips.callbacks.afterFooter.apply(this, arguments);

			var lines = [];
			lines = pushOrConcat(lines, beforeFooter);
			lines = pushOrConcat(lines, footer);
			lines = pushOrConcat(lines, afterFooter);

			return lines;
		},

		getAveragePosition: function(elements){

			if(!elements.length){
				return false;
			}

			var xPositions = [];
			var yPositions = [];

			helpers.each(elements, function(el){
				if(el) {
					var pos = el.tooltipPosition();
					xPositions.push(pos.x);
					yPositions.push(pos.y);
				}
			});

			var x = 0, y = 0;
			for (var i = 0; i < xPositions.length; i++) {
				x += xPositions[i];
				y += yPositions[i];
			}

			return {
				x: Math.round(x / xPositions.length),
				y: Math.round(y / xPositions.length)
			};

		},

		update: function(changed) {

			var ctx = this._chart.ctx;

			if(this._active.length){
				this._model.opacity = 1;

				var element = this._active[0],
					labelColors = [],
					tooltipPosition;

				var tooltipItems = [];

				if (this._options.tooltips.mode == 'single') {
					var yScale = element._yScale || element._scale; // handle radar || polarArea charts
					tooltipItems.push({
						xLabel: element._xScale ? element._xScale.getLabelForIndex(element._index, element._datasetIndex) : '',
						yLabel: yScale ? yScale.getLabelForIndex(element._index, element._datasetIndex) : '',
						index: element._index,
						datasetIndex: element._datasetIndex,
					});
					tooltipPosition = this.getAveragePosition(this._active);
				} else {
					helpers.each(this._data.datasets, function(dataset, datasetIndex) {
						if (!helpers.isDatasetVisible(dataset)) {
							return;
						}
						var currentElement = dataset.metaData[element._index];
						if (currentElement) {
							var yScale = element._yScale || element._scale; // handle radar || polarArea charts

							tooltipItems.push({
								xLabel: currentElement._xScale ? currentElement._xScale.getLabelForIndex(currentElement._index, currentElement._datasetIndex) : '',
								yLabel: yScale ? yScale.getLabelForIndex(currentElement._index, currentElement._datasetIndex) : '',
								index: element._index,
								datasetIndex: datasetIndex,
							});
						}
					});

					helpers.each(this._active, function(active, i) {
						if (active) {
						  labelColors.push({
						  	borderColor: active._view.borderColor,
						  	backgroundColor: active._view.backgroundColor
						  });
						}
					}, this);

					tooltipPosition = this.getAveragePosition(this._active);
					tooltipPosition.y = this._active[0]._yScale.getPixelForDecimal(0.5);
				}

				// Build the Text Lines
				helpers.extend(this._model, {
					title: this.getTitle(tooltipItems, this._data),
					beforeBody: this.getBeforeBody(tooltipItems, this._data),
					body: this.getBody(tooltipItems, this._data),
					afterBody: this.getAfterBody(tooltipItems, this._data),
					footer: this.getFooter(tooltipItems, this._data),
				});

				helpers.extend(this._model, {
					x: Math.round(tooltipPosition.x),
					y: Math.round(tooltipPosition.y),
					caretPadding: tooltipPosition.padding,
					labelColors: labelColors,
				});
			}
			else{
				this._model.opacity = 0;
			}

			if (changed && this._options.tooltips.custom) {
				this._options.tooltips.custom.call(this, this._model);
			}

			return this;
		},
		draw: function() {


			var ctx = this._chart.ctx;
			var vm = this._view;

			if (this._view.opacity === 0) {
				return;
			}

			// Get Dimensions

			vm.position = "top";

			var caretPadding = vm.caretPadding || 2;

			var combinedBodyLength = vm.body.length + vm.beforeBody.length + vm.afterBody.length;

			// Height
			var tooltipHeight = vm.yPadding * 2; // Tooltip Padding

			tooltipHeight += vm.title.length * vm.titleFontSize; // Title Lines
			tooltipHeight += (vm.title.length - 1) * vm.titleSpacing; // Title Line Spacing
			tooltipHeight += vm.title.length ? vm.titleMarginBottom : 0; // Title's bottom Margin

			tooltipHeight += combinedBodyLength * vm.bodyFontSize; // Body Lines
			tooltipHeight += (combinedBodyLength - 1) * vm.bodySpacing; // Body Line Spacing

			tooltipHeight += vm.footer.length ? vm.footerMarginTop : 0; // Footer Margin
			tooltipHeight += vm.footer.length * (vm.footerFontSize); // Footer Lines
			tooltipHeight += (vm.footer.length - 1) * vm.footerSpacing; // Footer Line Spacing

			// Width
			var tooltipWidth = 0;
			helpers.each(vm.title, function(line, i) {
				ctx.font = helpers.fontString(vm.titleFontSize, vm._titleFontStyle, vm._titleFontFamily);
				tooltipWidth = Math.max(tooltipWidth, ctx.measureText(line).width);
			});
			helpers.each(vm.body, function(line, i) {
				ctx.font = helpers.fontString(vm.bodyFontSize, vm._bodyFontStyle, vm._bodyFontFamily);
				tooltipWidth = Math.max(tooltipWidth, ctx.measureText(line).width + (this._options.tooltips.mode != 'single' ? (vm.bodyFontSize + 2) : 0));
			}, this);
			helpers.each(vm.footer, function(line, i) {
				ctx.font = helpers.fontString(vm.footerFontSize, vm._footerFontStyle, vm._footerFontFamily);
				tooltipWidth = Math.max(tooltipWidth, ctx.measureText(line).width);
			});
			tooltipWidth += 2 * vm.xPadding;
			var tooltipTotalWidth = tooltipWidth + vm.caretSize + caretPadding;



			// Smart Tooltip placement to stay on the canvas
			// Top, center, or bottom
			vm.yAlign = "center";
			if (vm.y - (tooltipHeight / 2) < 0) {
				vm.yAlign = "top";
			} else if (vm.y + (tooltipHeight / 2) > this._chart.height) {
				vm.yAlign = "bottom";
			}


			// Left or Right
			vm.xAlign = "right";
			if (vm.x + tooltipTotalWidth > this._chart.width) {
				vm.xAlign = "left";
			}


			// Background Position
			var tooltipX = vm.x,
				tooltipY = vm.y;

			if (vm.yAlign == 'top') {
				tooltipY = vm.y - vm.caretSize - vm.cornerRadius;
			} else if (vm.yAlign == 'bottom') {
				tooltipY = vm.y - tooltipHeight + vm.caretSize + vm.cornerRadius;
			} else {
				tooltipY = vm.y - (tooltipHeight / 2);
			}

			if (vm.xAlign == 'left') {
				tooltipX = vm.x - tooltipTotalWidth;
			} else if (vm.xAlign == 'right') {
				tooltipX = vm.x + caretPadding + vm.caretSize;
			} else {
				tooltipX = vm.x + (tooltipTotalWidth / 2);
			}

			// Draw Background

			if (this._options.tooltips.enabled) {
				ctx.fillStyle = helpers.color(vm.backgroundColor).alpha(vm.opacity).rgbString();
				helpers.drawRoundedRectangle(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, vm.cornerRadius);
				ctx.fill();
			}


			// Draw Caret
			if (this._options.tooltips.enabled) {
				ctx.fillStyle = helpers.color(vm.backgroundColor).alpha(vm.opacity).rgbString();

				if (vm.xAlign == 'left') {

					ctx.beginPath();
					ctx.moveTo(vm.x - caretPadding, vm.y);
					ctx.lineTo(vm.x - caretPadding - vm.caretSize, vm.y - vm.caretSize);
					ctx.lineTo(vm.x - caretPadding - vm.caretSize, vm.y + vm.caretSize);
					ctx.closePath();
					ctx.fill();
				} else {
					ctx.beginPath();
					ctx.moveTo(vm.x + caretPadding, vm.y);
					ctx.lineTo(vm.x + caretPadding + vm.caretSize, vm.y - vm.caretSize);
					ctx.lineTo(vm.x + caretPadding + vm.caretSize, vm.y + vm.caretSize);
					ctx.closePath();
					ctx.fill();
				}
			}

			// Draw Title, Body, and Footer

			if (this._options.tooltips.enabled) {

				var yBase = tooltipY + vm.yPadding;
				var xBase = tooltipX + vm.xPadding;

				// Titles

				if (vm.title.length) {
					ctx.textAlign = vm._titleAlign;
					ctx.textBaseline = "top";
					ctx.fillStyle = helpers.color(vm.titleColor).alpha(vm.opacity).rgbString();
					ctx.font = helpers.fontString(vm.titleFontSize, vm._titleFontStyle, vm._titleFontFamily);

					helpers.each(vm.title, function(title, i) {
						ctx.fillText(title, xBase, yBase);
						yBase += vm.titleFontSize + vm.titleSpacing; // Line Height and spacing
						if (i + 1 == vm.title.length) {
							yBase += vm.titleMarginBottom - vm.titleSpacing; // If Last, add margin, remove spacing
						}
					}, this);
				}


				// Body
				ctx.textAlign = vm._bodyAlign;
				ctx.textBaseline = "top";
				ctx.fillStyle = helpers.color(vm.bodyColor).alpha(vm.opacity).rgbString();
				ctx.font = helpers.fontString(vm.bodyFontSize, vm._bodyFontStyle, vm._bodyFontFamily);

				// Before Body
				helpers.each(vm.beforeBody, function(beforeBody, i) {
					ctx.fillText(vm.beforeBody, xBase, yBase);
					yBase += vm.bodyFontSize + vm.bodySpacing;
				});

				helpers.each(vm.body, function(body, i) {


					// Draw Legend-like boxes if needed
					if (this._options.tooltips.mode != 'single') {
						// Fill a white rect so that colours merge nicely if the opacity is < 1
						ctx.fillStyle = helpers.color('#FFFFFF').alpha(vm.opacity).rgbaString();
						ctx.fillRect(xBase, yBase, vm.bodyFontSize, vm.bodyFontSize);

						// Border
						ctx.strokeStyle = helpers.color(vm.labelColors[i].borderColor).alpha(vm.opacity).rgbaString();
						ctx.strokeRect(xBase, yBase, vm.bodyFontSize, vm.bodyFontSize);

						// Inner square
						ctx.fillStyle = helpers.color(vm.labelColors[i].backgroundColor).alpha(vm.opacity).rgbaString();
						ctx.fillRect(xBase + 1, yBase + 1, vm.bodyFontSize - 2, vm.bodyFontSize - 2);

						ctx.fillStyle = helpers.color(vm.bodyColor).alpha(vm.opacity).rgbaString(); // Return fill style for text
					}

					// Body Line
					ctx.fillText(body, xBase + (this._options.tooltips.mode != 'single' ? (vm.bodyFontSize + 2) : 0), yBase);

					yBase += vm.bodyFontSize + vm.bodySpacing;

				}, this);

				// After Body
				helpers.each(vm.afterBody, function(afterBody, i) {
					ctx.fillText(vm.afterBody, xBase, yBase);
					yBase += vm.bodyFontSize;
				});

				yBase -= vm.bodySpacing; // Remove last body spacing


				// Footer
				if (vm.footer.length) {

					yBase += vm.footerMarginTop;

					ctx.textAlign = vm._footerAlign;
					ctx.textBaseline = "top";
					ctx.fillStyle = helpers.color(vm.footerColor).alpha(vm.opacity).rgbString();
					ctx.font = helpers.fontString(vm.footerFontSize, vm._footerFontStyle, vm._footerFontFamily);

					helpers.each(vm.footer, function(footer, i) {
						ctx.fillText(footer, xBase, yBase);
						yBase += vm.footerFontSize + vm.footerSpacing;
					}, this);
				}

			}
		},
	});

}).call(this);

(function() {

	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.line = {
		hover: {
			mode: "label"
		},

		scales: {
			xAxes: [{
				type: "category",
				id: 'x-axis-0'
			}],
			yAxes: [{
				type: "linear",
				id: 'y-axis-0'
			}],
		},
	};


	Chart.controllers.line = function(chart, datasetIndex) {
		this.initialize.call(this, chart, datasetIndex);
	};

	helpers.extend(Chart.controllers.line.prototype, {

		initialize: function(chart, datasetIndex) {
			this.chart = chart;
			this.index = datasetIndex;
			this.linkScales();
			this.addElements();
		},
		updateIndex: function(datasetIndex) {
			this.index = datasetIndex;
		},

		linkScales: function() {
			if (!this.getDataset().xAxisID) {
				this.getDataset().xAxisID = this.chart.options.scales.xAxes[0].id;
			}

			if (!this.getDataset().yAxisID) {
				this.getDataset().yAxisID = this.chart.options.scales.yAxes[0].id;
			}
		},

		getDataset: function() {
			return this.chart.data.datasets[this.index];
		},

		getScaleForId: function(scaleID) {
			return this.chart.scales[scaleID];
		},

		addElements: function() {

			this.getDataset().metaData = this.getDataset().metaData || [];

			this.getDataset().metaDataset = this.getDataset().metaDataset || new Chart.elements.Line({
				_chart: this.chart.chart,
				_datasetIndex: this.index,
				_points: this.getDataset().metaData,
			});

			helpers.each(this.getDataset().data, function(value, index) {
				this.getDataset().metaData[index] = this.getDataset().metaData[index] || new Chart.elements.Point({
					_chart: this.chart.chart,
					_datasetIndex: this.index,
					_index: index,
				});
			}, this);
		},
		addElementAndReset: function(index) {
			this.getDataset().metaData = this.getDataset().metaData || [];
			var point = new Chart.elements.Point({
				_chart: this.chart.chart,
				_datasetIndex: this.index,
				_index: index,
			});

			// Reset the point
			this.updateElement(point, index, true);

			// Add to the points array
			this.getDataset().metaData.splice(index, 0, point);

			// Make sure bezier control points are updated
			this.updateBezierControlPoints();
		},
		removeElement: function(index) {
			this.getDataset().metaData.splice(index, 1);
		},

		reset: function() {
			this.update(true);
		},

		buildOrUpdateElements: function buildOrUpdateElements() {
			// Handle the number of data points changing
			var numData = this.getDataset().data.length;
			var numPoints = this.getDataset().metaData.length;

			// Make sure that we handle number of datapoints changing
			if (numData < numPoints) {
				// Remove excess bars for data points that have been removed
				this.getDataset().metaData.splice(numData, numPoints - numData);
			} else if (numData > numPoints) {
				// Add new elements
				for (var index = numPoints; index < numData; ++index) {
					this.addElementAndReset(index);
				}
			}
		},

		update: function update(reset) {
			var line = this.getDataset().metaDataset;
			var points = this.getDataset().metaData;

			var yScale = this.getScaleForId(this.getDataset().yAxisID);
			var xScale = this.getScaleForId(this.getDataset().xAxisID);
			var scaleBase;

			if (yScale.min < 0 && yScale.max < 0) {
				scaleBase = yScale.getPixelForValue(yScale.max);
			} else if (yScale.min > 0 && yScale.max > 0) {
				scaleBase = yScale.getPixelForValue(yScale.min);
			} else {
				scaleBase = yScale.getPixelForValue(0);
			}

			// Update Line
			helpers.extend(line, {
				// Utility
				_scale: yScale,
				_datasetIndex: this.index,
				// Data
				_children: points,
				// Model
				_model: {
					// Appearance
					tension: line.custom && line.custom.tension ? line.custom.tension : (this.getDataset().tension || this.chart.options.elements.line.tension),
					backgroundColor: line.custom && line.custom.backgroundColor ? line.custom.backgroundColor : (this.getDataset().backgroundColor || this.chart.options.elements.line.backgroundColor),
					borderWidth: line.custom && line.custom.borderWidth ? line.custom.borderWidth : (this.getDataset().borderWidth || this.chart.options.elements.line.borderWidth),
					borderColor: line.custom && line.custom.borderColor ? line.custom.borderColor : (this.getDataset().borderColor || this.chart.options.elements.line.borderColor),
					borderCapStyle: line.custom && line.custom.borderCapStyle ? line.custom.borderCapStyle : (this.getDataset().borderCapStyle || this.chart.options.elements.line.borderCapStyle),
					borderDash: line.custom && line.custom.borderDash ? line.custom.borderDash : (this.getDataset().borderDash || this.chart.options.elements.line.borderDash),
					borderDashOffset: line.custom && line.custom.borderDashOffset ? line.custom.borderDashOffset : (this.getDataset().borderDashOffset || this.chart.options.elements.line.borderDashOffset),
					borderJoinStyle: line.custom && line.custom.borderJoinStyle ? line.custom.borderJoinStyle : (this.getDataset().borderJoinStyle || this.chart.options.elements.line.borderJoinStyle),
					fill: line.custom && line.custom.fill ? line.custom.fill : (this.getDataset().fill !== undefined ? this.getDataset().fill : this.chart.options.elements.line.fill),
					// Scale
					scaleTop: yScale.top,
					scaleBottom: yScale.bottom,
					scaleZero: scaleBase,
				},
			});
			line.pivot();

			// Update Points
			helpers.each(points, function(point, index) {
				this.updateElement(point, index, reset);
			}, this);

			this.updateBezierControlPoints();
		},

		getPointBackgroundColor: function(point, index) {
			var backgroundColor = this.chart.options.elements.point.backgroundColor;
			var dataset = this.getDataset();

			if (point.custom && point.custom.backgroundColor) {
				backgroundColor = point.custom.backgroundColor;
			} else if (dataset.pointBackgroundColor) {
				backgroundColor = helpers.getValueAtIndexOrDefault(dataset.pointBackgroundColor, index, backgroundColor);
			} else if (dataset.backgroundColor) {
				backgroundColor = dataset.backgroundColor;
			}

			return backgroundColor;
		},
		getPointBorderColor: function(point, index) {
			var borderColor = this.chart.options.elements.point.borderColor;
			var dataset = this.getDataset();

			if (point.custom && point.custom.borderColor) {
				borderColor = point.custom.borderColor;
			} else if (dataset.pointBorderColor) {
				borderColor = helpers.getValueAtIndexOrDefault(this.getDataset().pointBorderColor, index, borderColor);
			} else if (dataset.borderColor) {
				borderColor = dataset.borderColor;
			}

			return borderColor;
		},
		getPointBorderWidth: function(point, index) {
			var borderWidth = this.chart.options.elements.point.borderWidth;
			var dataset = this.getDataset();

			if (point.custom && point.custom.borderWidth !== undefined) {
				borderWidth = point.custom.borderWidth;
			} else if (dataset.pointBorderWidth !== undefined) {
				borderWidth = helpers.getValueAtIndexOrDefault(dataset.pointBorderWidth, index, borderWidth);
			} else if (dataset.borderWidth !== undefined) {
				borderWidth = dataset.borderWidth;
			}

			return borderWidth;
		},

		updateElement: function(point, index, reset) {
			var yScale = this.getScaleForId(this.getDataset().yAxisID);
			var xScale = this.getScaleForId(this.getDataset().xAxisID);
			var scaleBase;

			if (yScale.min < 0 && yScale.max < 0) {
				scaleBase = yScale.getPixelForValue(yScale.max);
			} else if (yScale.min > 0 && yScale.max > 0) {
				scaleBase = yScale.getPixelForValue(yScale.min);
			} else {
				scaleBase = yScale.getPixelForValue(0);
			}

			helpers.extend(point, {
				// Utility
				_chart: this.chart.chart,
				_xScale: xScale,
				_yScale: yScale,
				_datasetIndex: this.index,
				_index: index,

				// Desired view properties
				_model: {
					x: xScale.getPixelForValue(this.getDataset().data[index], index, this.index, this.chart.isCombo),
					y: reset ? scaleBase : this.calculatePointY(this.getDataset().data[index], index, this.index, this.chart.isCombo),
					// Appearance
					tension: point.custom && point.custom.tension ? point.custom.tension : (this.getDataset().tension || this.chart.options.elements.line.tension),
					radius: point.custom && point.custom.radius ? point.custom.radius : helpers.getValueAtIndexOrDefault(this.getDataset().radius, index, this.chart.options.elements.point.radius),
					backgroundColor: this.getPointBackgroundColor(point, index),
					borderColor: this.getPointBorderColor(point, index),
					borderWidth: this.getPointBorderWidth(point, index),
					// Tooltip
					hitRadius: point.custom && point.custom.hitRadius ? point.custom.hitRadius : helpers.getValueAtIndexOrDefault(this.getDataset().hitRadius, index, this.chart.options.elements.point.hitRadius),
				},
			});

			point._model.skip = point.custom && point.custom.skip ? point.custom.skip : (isNaN(point._model.x) || isNaN(point._model.y));
		},

		calculatePointY: function(value, index, datasetIndex, isCombo) {

			var xScale = this.getScaleForId(this.getDataset().xAxisID);
			var yScale = this.getScaleForId(this.getDataset().yAxisID);

			if (yScale.options.stacked) {

				var sumPos = 0,
					sumNeg = 0;

				for (var i = this.chart.data.datasets.length - 1; i > datasetIndex; i--) {
					var ds = this.chart.data.datasets[i];
					if (helpers.isDatasetVisible(ds)) {
						if (ds.data[index] < 0) {
							sumNeg += ds.data[index] || 0;
						} else {
							sumPos += ds.data[index] || 0;
						}
					}
				}

				if (value < 0) {
					return yScale.getPixelForValue(sumNeg + value);
				} else {
					return yScale.getPixelForValue(sumPos + value);
				}

				return yScale.getPixelForValue(value);
			}

			return yScale.getPixelForValue(value);
		},

		updateBezierControlPoints: function() {
			// Update bezier control points
			helpers.each(this.getDataset().metaData, function(point, index) {
				var controlPoints = helpers.splineCurve(
					helpers.previousItem(this.getDataset().metaData, index)._model,
					point._model,
					helpers.nextItem(this.getDataset().metaData, index)._model,
					point._model.tension
				);

				// Prevent the bezier going outside of the bounds of the graph
				point._model.controlPointPreviousX = Math.max(Math.min(controlPoints.previous.x, this.chart.chartArea.right), this.chart.chartArea.left);
				point._model.controlPointPreviousY = Math.max(Math.min(controlPoints.previous.y, this.chart.chartArea.bottom), this.chart.chartArea.top);

				point._model.controlPointNextX = Math.max(Math.min(controlPoints.next.x, this.chart.chartArea.right), this.chart.chartArea.left);
				point._model.controlPointNextY = Math.max(Math.min(controlPoints.next.y, this.chart.chartArea.bottom), this.chart.chartArea.top);

				// Now pivot the point for animation
				point.pivot();
			}, this);
		},

		draw: function(ease) {
			var easingDecimal = ease || 1;

			// Transition Point Locations
			helpers.each(this.getDataset().metaData, function(point, index) {
				point.transition(easingDecimal);
			}, this);

			// Transition and Draw the line
			this.getDataset().metaDataset.transition(easingDecimal).draw();

			// Draw the points
			helpers.each(this.getDataset().metaData, function(point) {
				point.draw();
			});
		},

		setHoverStyle: function(point) {
			// Point
			var dataset = this.chart.data.datasets[point._datasetIndex];
			var index = point._index;

			point._model.radius = point.custom && point.custom.hoverRadius ? point.custom.hoverRadius : helpers.getValueAtIndexOrDefault(dataset.pointHoverRadius, index, this.chart.options.elements.point.hoverRadius);
			point._model.backgroundColor = point.custom && point.custom.hoverBackgroundColor ? point.custom.hoverBackgroundColor : helpers.getValueAtIndexOrDefault(dataset.pointHoverBackgroundColor, index, helpers.color(point._model.backgroundColor).saturate(0.5).darken(0.1).rgbString());
			point._model.borderColor = point.custom && point.custom.hoverBorderColor ? point.custom.hoverBorderColor : helpers.getValueAtIndexOrDefault(dataset.pointHoverBorderColor, index, helpers.color(point._model.borderColor).saturate(0.5).darken(0.1).rgbString());
			point._model.borderWidth = point.custom && point.custom.hoverBorderWidth ? point.custom.hoverBorderWidth : helpers.getValueAtIndexOrDefault(dataset.pointHoverBorderWidth, index, point._model.borderWidth);
		},

		removeHoverStyle: function(point) {
			var dataset = this.chart.data.datasets[point._datasetIndex];
			var index = point._index;

			point._model.radius = point.custom && point.custom.radius ? point.custom.radius : helpers.getValueAtIndexOrDefault(this.getDataset().radius, index, this.chart.options.elements.point.radius);
			point._model.backgroundColor = this.getPointBackgroundColor(point, index);
			point._model.borderColor = this.getPointBorderColor(point, index);
			point._model.borderWidth = this.getPointBorderWidth(point, index);
		}
	});
}).call(this);

(function() {
    "use strict";

    var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;

    // Default config for a category scale
    var defaultConfig = {
        position: "bottom",
    };

    var DatasetScale = Chart.Scale.extend({
        buildTicks: function(index) {
            this.ticks = this.chart.data.labels;
        },

        getLabelForIndex: function(index, datasetIndex) {
            return this.ticks[index];
        },

        // Used to get data value locations.  Value can either be an index or a numerical value
        getPixelForValue: function(value, index, datasetIndex, includeOffset) {
            if (this.isHorizontal()) {
                var innerWidth = this.width - (this.paddingLeft + this.paddingRight);
                var valueWidth = innerWidth / Math.max((this.chart.data.labels.length - ((this.options.gridLines.offsetGridLines) ? 0 : 1)), 1);
                var widthOffset = (valueWidth * index) + this.paddingLeft;

                if (this.options.gridLines.offsetGridLines && includeOffset) {
                    widthOffset += (valueWidth / 2);
                }

                return this.left + Math.round(widthOffset);
            } else {
                var innerHeight = this.height - (this.paddingTop + this.paddingBottom);
                var valueHeight = innerHeight / Math.max((this.chart.data.labels.length - ((this.options.gridLines.offsetGridLines) ? 0 : 1)), 1);
                var heightOffset = (valueHeight * index) + this.paddingTop;

                if (this.options.gridLines.offsetGridLines && includeOffset) {
                    heightOffset += (valueHeight / 2);
                }

                return this.top + Math.round(heightOffset);
            }
        },
    });

    Chart.scaleService.registerScaleType("category", DatasetScale, defaultConfig);

}).call(this);

(function() {
	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	var defaultConfig = {
		position: "left",
		ticks: {
			callback: function(tickValue, index, ticks) {
				var delta = ticks[1] - ticks[0];

				// If we have a number like 2.5 as the delta, figure out how many decimal places we need
				if (Math.abs(delta) > 1) {
					if (tickValue !== Math.floor(tickValue)) {
						// not an integer
						delta = tickValue - Math.floor(tickValue);
					}
				}

				var logDelta = helpers.log10(Math.abs(delta));
				var tickString = '';

				if (tickValue !== 0) {
					var numDecimal = -1 * Math.floor(logDelta);
					numDecimal = Math.max(Math.min(numDecimal, 20), 0); // toFixed has a max of 20 decimal places
					tickString = tickValue.toFixed(numDecimal);
				} else {
					tickString = '0'; // never show decimal places for 0
				}

				return tickString;
			}
		}
	};

	var LinearScale = Chart.Scale.extend({
		buildTicks: function() {

			// First Calculate the range
			this.min = null;
			this.max = null;

			if (this.options.stacked) {
				var valuesPerType = {};

				helpers.each(this.chart.data.datasets, function(dataset) {
					if (valuesPerType[dataset.type] === undefined) {
						valuesPerType[dataset.type] = {
							positiveValues: [],
							negativeValues: [],
						};
					}

					// Store these per type
					var positiveValues = valuesPerType[dataset.type].positiveValues;
					var negativeValues = valuesPerType[dataset.type].negativeValues;

					if (helpers.isDatasetVisible(dataset) && (this.isHorizontal() ? dataset.xAxisID === this.id : dataset.yAxisID === this.id)) {
						helpers.each(dataset.data, function(rawValue, index) {

							var value = +this.getRightValue(rawValue);
							if (isNaN(value)) {
								return;
							}

							positiveValues[index] = positiveValues[index] || 0;
							negativeValues[index] = negativeValues[index] || 0;

							if (this.options.relativePoints) {
								positiveValues[index] = 100;
							} else {
								if (value < 0) {
									negativeValues[index] += value;
								} else {
									positiveValues[index] += value;
								}
							}
						}, this);
					}
				}, this);

				helpers.each(valuesPerType, function(valuesForType) {
					var values = valuesForType.positiveValues.concat(valuesForType.negativeValues);
					var minVal = helpers.min(values);
					var maxVal = helpers.max(values);
					this.min = this.min === null ? minVal : Math.min(this.min, minVal);
					this.max = this.max === null ? maxVal : Math.max(this.max, maxVal);
				}, this);

			} else {
				helpers.each(this.chart.data.datasets, function(dataset) {
					if (helpers.isDatasetVisible(dataset) && (this.isHorizontal() ? dataset.xAxisID === this.id : dataset.yAxisID === this.id)) {
						helpers.each(dataset.data, function(rawValue, index) {
							var value = +this.getRightValue(rawValue);
							if (isNaN(value)) {
								return;
							}

							if (this.min === null) {
								this.min = value;
							} else if (value < this.min) {
								this.min = value;
							}

							if (this.max === null) {
								this.max = value;
							} else if (value > this.max) {
								this.max = value;
							}
						}, this);
					}
				}, this);
			}

			// Then calulate the ticks
			this.ticks = [];

			// Figure out what the max number of ticks we can support it is based on the size of
			// the axis area. For now, we say that the minimum tick spacing in pixels must be 50
			// We also limit the maximum number of ticks to 11 which gives a nice 10 squares on
			// the graph

			var maxTicks;

			if (this.isHorizontal()) {
				maxTicks = Math.min(this.options.ticks.maxTicksLimit ? this.options.ticks.maxTicksLimit : 11,
				                    Math.ceil(this.width / 50));
			} else {
				// The factor of 2 used to scale the font size has been experimentally determined.
				maxTicks = Math.min(this.options.ticks.maxTicksLimit ? this.options.ticks.maxTicksLimit : 11,
				                    Math.ceil(this.height / (2 * this.options.ticks.fontSize)));
			}

			// Make sure we always have at least 2 ticks
			maxTicks = Math.max(2, maxTicks);

			// To get a "nice" value for the tick spacing, we will use the appropriately named
			// "nice number" algorithm. See http://stackoverflow.com/questions/8506881/nice-label-algorithm-for-charts-with-minimum-ticks
			// for details.

			// If we are forcing it to begin at 0, but 0 will already be rendered on the chart,
			// do nothing since that would make the chart weird. If the user really wants a weird chart
			// axis, they can manually override it
			if (this.options.ticks.beginAtZero) {
				var minSign = helpers.sign(this.min);
				var maxSign = helpers.sign(this.max);

				if (minSign < 0 && maxSign < 0) {
					// move the top up to 0
					this.max = 0;
				} else if (minSign > 0 && maxSign > 0) {
					// move the botttom down to 0
					this.min = 0;
				}
			}

			if (this.options.ticks.suggestedMin) {
				this.min = Math.min(this.min, this.options.ticks.suggestedMin);
			}

			if (this.options.ticks.suggestedMax) {
				this.max = Math.max(this.max, this.options.ticks.suggestedMax);
			}

			if (this.min === this.max) {
				this.min--;
				this.max++;
			}

			// var niceRange = helpers.niceNum(this.max - this.min, false);
			// var spacing = helpers.niceNum(niceRange / (maxTicks - 1), true);
			// var niceMin = Math.floor(this.min / spacing) * spacing;
			// var niceMax = Math.ceil(this.max / spacing) * spacing;
			var niceRange = this.max - this.min;
			var spacing = (niceRange / (maxTicks - 1)).toFixed(4);
			var niceMin = this.min;
			var niceMax = this.max;

			var numSpaces = Math.round((niceMax - niceMin) / spacing);

			// Put the values into the ticks array
			for (var j = 0; j <= numSpaces; ++j) {
				this.ticks.push(niceMin + (j * spacing));
			}

			if (this.options.position == "left" || this.options.position == "right") {
				// We are in a vertical orientation. The top value is the highest. So reverse the array
				this.ticks.reverse();
			}

			// At this point, we need to update our max and min given the tick values since we have expanded the
			// range of the scale
			this.max = helpers.max(this.ticks);
			this.min = helpers.min(this.ticks);

			if (this.options.ticks.reverse) {
				this.ticks.reverse();

				this.start = this.max;
				this.end = this.min;
			} else {
				this.start = this.min;
				this.end = this.max;
			}

			this.zeroLineIndex = this.ticks.indexOf(0);
		},

		getLabelForIndex: function(index, datasetIndex) {
			return +this.getRightValue(this.chart.data.datasets[datasetIndex].data[index]);
		},

		// Utils
		getPixelForValue: function(value, index, datasetIndex, includeOffset) {
			// This must be called after fit has been run so that
			//      this.left, this.top, this.right, and this.bottom have been defined
			var rightValue = +this.getRightValue(value);
			var pixel;
			var range = this.end - this.start;

			if (this.isHorizontal()) {

				var innerWidth = this.width - (this.paddingLeft + this.paddingRight);
				pixel = this.left + (innerWidth / range * (rightValue - this.start));
				return Math.round(pixel + this.paddingLeft);
			} else {
				var innerHeight = this.height - (this.paddingTop + this.paddingBottom);
				pixel = (this.bottom - this.paddingBottom) - (innerHeight / range * (rightValue - this.start));
				return Math.round(pixel);
			}
		},
	});
	Chart.scaleService.registerScaleType("linear", LinearScale, defaultConfig);

}).call(this);

/*!
 * Chart.js
 * http://chartjs.org/
 * Version: 2.0.0-beta
 *
 * Copyright 2015 Nick Downie
 * Released under the MIT license
 * https://github.com/nnnick/Chart.js/blob/master/LICENSE.md
 */


(function() {

	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.global.elements.line = {
		tension: 0.4,
		backgroundColor: Chart.defaults.global.defaultColor,
		borderWidth: 3,
		borderColor: Chart.defaults.global.defaultColor,
		borderCapStyle: 'butt',
		borderDash: [],
		borderDashOffset: 0.0,
		borderJoinStyle: 'round',
		fill: true, // do we fill in the area between the line and its base axis
	};

	Chart.elements.Line = Chart.Element.extend({
		lineToNextPoint: function(previousPoint, point, nextPoint, skipHandler, previousSkipHandler) {
			var ctx = this._chart.ctx;

			if (point._view.skip) {
				skipHandler.call(this, previousPoint, point, nextPoint);
			} else if (previousPoint._view.skip) {
				previousSkipHandler.call(this, previousPoint, point, nextPoint);
			} else {
				// Line between points
				// ctx.bezierCurveTo(
				// 	previousPoint._view.controlPointNextX,
				// 	previousPoint._view.controlPointNextY,
				// 	point._view.controlPointPreviousX,
				// 	point._view.controlPointPreviousY,
				// 	point._view.x,
				// 	point._view.y
				// );
				ctx.lineTo(point._view.x, point._view.y)
			}
		},

		draw: function() {
			var _this = this;

			var vm = this._view;
			var ctx = this._chart.ctx;
			var first = this._children[0];
			var last = this._children[this._children.length - 1];

			function loopBackToStart(drawLineToCenter) {
				if (!first._view.skip && !last._view.skip) {
					// Draw a bezier line from last to first
					ctx.bezierCurveTo(
						last._view.controlPointNextX,
						last._view.controlPointNextY,
						first._view.controlPointPreviousX,
						first._view.controlPointPreviousY,
						first._view.x,
						first._view.y
					);
				} else if (drawLineToCenter) {
					// Go to center
					ctx.lineTo(_this._view.scaleZero.x, _this._view.scaleZero.y);
				}
			}

			ctx.save();

			// If we had points and want to fill this line, do so.
			if (this._children.length > 0 && vm.fill) {
				// Draw the background first (so the border is always on top)
				ctx.beginPath();

				helpers.each(this._children, function(point, index) {
					var previous = helpers.previousItem(this._children, index);
					var next = helpers.nextItem(this._children, index);

					// First point moves to it's starting position no matter what
					if (index === 0) {
						if (this._loop) {
							ctx.moveTo(vm.scaleZero.x, vm.scaleZero.y);
						} else {
							ctx.moveTo(point._view.x, vm.scaleZero);
						}

						if (point._view.skip) {
							if (!this._loop) {
								ctx.moveTo(next._view.x, this._view.scaleZero);
							}
						} else {
							ctx.lineTo(point._view.x, point._view.y);
						}
					} else {
						this.lineToNextPoint(previous, point, next, function(previousPoint, point, nextPoint) {
							if (this._loop) {
								// Go to center
								ctx.lineTo(this._view.scaleZero.x, this._view.scaleZero.y);
							} else {
								ctx.lineTo(previousPoint._view.x, this._view.scaleZero);
								ctx.moveTo(nextPoint._view.x, this._view.scaleZero);
							}
						}, function(previousPoint, point, nextPoint) {
							// If we skipped the last point, draw a line to ourselves so that the fill is nice
							ctx.lineTo(point._view.x, point._view.y);
						});
					}
				}, this);

				// For radial scales, loop back around to the first point
				if (this._loop) {
					loopBackToStart(true);
				} else {
					//Round off the line by going to the base of the chart, back to the start, then fill.
					ctx.lineTo(this._children[this._children.length - 1]._view.x, vm.scaleZero);
					ctx.lineTo(this._children[0]._view.x, vm.scaleZero);
				}

				ctx.fillStyle = vm.backgroundColor || Chart.defaults.global.defaultColor;
				ctx.closePath();
				ctx.fill();
			}

			// Now draw the line between all the points with any borders
			ctx.lineCap = vm.borderCapStyle || Chart.defaults.global.elements.line.borderCapStyle;

			// IE 9 and 10 do not support line dash
			if (ctx.setLineDash) {
				ctx.setLineDash(vm.borderDash || Chart.defaults.global.elements.line.borderDash);
			}

			ctx.lineDashOffset = vm.borderDashOffset || Chart.defaults.global.elements.line.borderDashOffset;
			ctx.lineJoin = vm.borderJoinStyle || Chart.defaults.global.elements.line.borderJoinStyle;
			ctx.lineWidth = vm.borderWidth || Chart.defaults.global.elements.line.borderWidth;
			ctx.strokeStyle = vm.borderColor || Chart.defaults.global.defaultColor;
			ctx.beginPath();

			helpers.each(this._children, function(point, index) {
				var previous = helpers.previousItem(this._children, index);
				var next = helpers.nextItem(this._children, index);

				if (index === 0) {
					ctx.moveTo(point._view.x, point._view.y);
				} else {
					this.lineToNextPoint(previous, point, next, function(previousPoint, point, nextPoint) {
						ctx.moveTo(nextPoint._view.x, nextPoint._view.y);
					}, function(previousPoint, point, nextPoint) {
						// If we skipped the last point, move up to our point preventing a line from being drawn
						ctx.moveTo(point._view.x, point._view.y);
					});
				}
			}, this);

			if (this._loop) {
				loopBackToStart();
			}

			ctx.stroke();
			ctx.restore();
		},
	});

}).call(this);

/*!
 * Chart.js
 * http://chartjs.org/
 * Version: 2.0.0-beta
 *
 * Copyright 2015 Nick Downie
 * Released under the MIT license
 * https://github.com/nnnick/Chart.js/blob/master/LICENSE.md
 */


(function() {

	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.global.elements.point = {
		radius: 0,
		backgroundColor: Chart.defaults.global.defaultColor,
		borderWidth: 1,
		borderColor: Chart.defaults.global.defaultColor,
		// Hover
		hitRadius: 0,
		hoverRadius: 0,
		hoverBorderWidth: 1,
	};


	Chart.elements.Point = Chart.Element.extend({
		inRange: function(mouseX, mouseY) {
			var vm = this._view;

			if (vm) {
				var hoverRange = vm.hitRadius + vm.radius;
				return ((Math.pow(mouseX - vm.x, 2) + Math.pow(mouseY - vm.y, 2)) < Math.pow(hoverRange, 2));
			} else {
				return false;
			}
		},
		inLabelRange: function(mouseX) {
			var vm = this._view;

			if (vm) {
				return (Math.pow(mouseX - vm.x, 2) < Math.pow(vm.radius + vm.hitRadius, 2));
			} else {
				return false;
			}
		},
		tooltipPosition: function() {
			var vm = this._view;
			return {
				x: vm.x,
				y: vm.y,
				padding: vm.radius + vm.borderWidth
			};
		},
		draw: function() {

			var vm = this._view;
			var ctx = this._chart.ctx;


			if (vm.skip) {
				return;
			}

			if (vm.radius > 0 || vm.borderWidth > 0) {

				ctx.beginPath();

				ctx.arc(vm.x, vm.y, vm.radius || Chart.defaults.global.elements.point.radius, 0, Math.PI * 2);
				ctx.closePath();

				ctx.strokeStyle = vm.borderColor || Chart.defaults.global.defaultColor;
				ctx.lineWidth = vm.borderWidth || Chart.defaults.global.elements.point.borderWidth;

				ctx.fillStyle = vm.backgroundColor || Chart.defaults.global.defaultColor;

				ctx.fill();
				ctx.stroke();
			}
		}
	});


}).call(this);

(function() {
	"use strict";

	var root = this;
	var Chart = root.Chart;
	var helpers = Chart.helpers;

	Chart.Line = function(context, config) {
		config.type = 'line';

		return new Chart(context, config);
	};
	
}).call(this);

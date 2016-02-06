var bracket = function(mfnc, x0, eps) {
	var xs, rho = 1.618;

	if (mfnc(x0 + eps) < mfnc(x0)) {
		xs = [x0 + eps, x0];
	} else if (mfnc(x0 - eps) < mfnc(x0)) {
		xs = [x0 - eps, x0];
	} else {
		return [x0 + eps, x0 - eps];
	}

	var ctr = 0;

	var stoppingCondition = function(xs) {
		ctr += 1;
		return mfnc(xs[0]) > mfnc(xs[1]);
	};

	while (!stoppingCondition(xs)) {
		xs.splice(0, 0, xs[0] + rho * (xs[0] - xs[1]));
	}

	return xs[0] > xs[2] ? [xs[2], xs[0]] : [xs[0], xs[2]];
};

var goldsec = function(interval, mfnc, eps) {
	var a = interval[0], b = interval[1], tau = 0.618;
	var l =  a + (1 - tau) * (b - a);
	var r = a + tau * (b - a);
	while (b - a >= eps) {
		if (mfnc(r) < mfnc(l)) {
			a = l;
			l = r;
			r = a + tau * (b - a);
		} else {
			b = r;
			r = l;
			l = a + (1 - tau) * (b - a);
		}
	}
	return (a + b) / 2;
};

function memoize(fnc) {
	var memo = new LRUCache(20);

	return function(x) {
		var xstr = JSON.stringify(x);

		if (memo.find(xstr)) {
			return memo.get(xstr);
		} else {
			var fx = fnc(x);
			memo.put(xstr, fx);
			return fx;
		}
	};
}

var gradient_descent = function(x0, f, df, eps) {
	var optimizeAlongLine = function(x0, f, d, eps) {
		eps = eps * 0.1;
		var unitD = num.normalize(d);
		var transformedF = function(scalarX) {
			var x = num.vecSum(x0, num.vecProd(unitD, scalarX));
			return f(x);
		};
		var memoizedTransformedF = memoize(transformedF);
		var interval = bracket(memoizedTransformedF, 0, eps);
		var optValue = goldsec(interval, memoizedTransformedF, eps);
		return num.vecSum(x0, num.vecProd(unitD, optValue));
	};

	var n = x0.length;
	var x = x0.slice(0);
	var delta = df(x);
	var dir;
	var ctr = 0;
	var prev_x;

	while (num.norm2(delta) >= eps && ctr <= 10) {
		dir = num.normalize(delta);
		prev_x = x;
		x = optimizeAlongLine(x, f, dir, eps);
		delta = df(x);
		if (num.norm2(num.vecSub(prev_x, x)) < eps) {
			break;
		}
		ctr += 1;
	}
	return x;
};

var powell = function(x0, f, eps, callback) {
	return new Promise(function(resolve, reject) {
		var mf = memoize(f);
		var n = x0.length;
		var directions = _.map(_.range(n), function(i) {
			var zeros = _.times(n, function() { return 0; });
			zeros[i] = 1;
			return zeros;
		});
		// xs[k][i] is value of x after k iterations and the i^th coordinated updated
		var new_xs = [x0];
		var all_xs = [new_xs];
		var d, di;

		var optimizeAlongLine = function(x0, f, d, eps) {
			eps = eps * 0.1;
			var unitD = num.normalize(d);
			var transformedF = function(scalarX) {
				var x = num.vecSum(x0, num.vecProd(unitD, scalarX));
				return f(x);
			};
			var memoizedTransformedF = memoize(transformedF);
			var interval = bracket(memoizedTransformedF, 0, eps);
			var optValue = goldsec(interval, memoizedTransformedF, eps);
			return num.vecSum(x0, num.vecProd(unitD, optValue));
		};

		var ctr = 0;

		var loopIteration = function() {
			ctr ++;
			for (var i = 0; i < n; i++) {
				di = directions[i];
				new_xs.splice(0, 0, optimizeAlongLine(new_xs[0], f, di, eps));
			}
			d = num.vecSub(new_xs[0], new_xs[new_xs.length - 1]);
			if (num.norm2(d) < eps) {
				// break
				callback(all_xs[0][0]);
			} else {
				new_xs = [optimizeAlongLine(new_xs[0], f, d, eps)];
				all_xs.splice(0, 0, new_xs);
				directions.splice(0, 1);
				directions.push(d);
				console.log(mf(all_xs[0][0]), all_xs[0][0]);
				if (Math.abs(mf(all_xs[0][0]) - mf(all_xs[1][0])) >= eps) {
					// call loop iteration again
					window.setTimeout(loopIteration, 0);
				} else {
					// break
					callback(all_xs[0][0]);
				}
			}
		};
		loopIteration();
	});
};

var _ = {};

_.now = Date.now || function() {
  return new Date().getTime();
};

_.compose = function() {
  var args = arguments;
  var start = args.length - 1;
  return function() {
    var i = start;
    var result = args[start].apply(this, arguments);
    while (i--) result = args[i].call(this, result);
    return result;
  };
};

_.mergeDeep = function (A, B, depth) {
  var forever = depth == null; // eslint-ignore-line eqeqeq
  for (var p in B) {
    if (B[p] !== null && typeof B[p] !== 'undefined' && B[p].constructor === Object && (forever || depth > 0)) {
      A[p] = _.mergeDeep(
        A.hasOwnProperty(p) ? A[p] : {},
        B[p],
        forever ? null : depth - 1
      );
    }
    // we generally don't want 'undefined' values in our maps
    else if (typeof B[p] === 'undefined') {} // esline-ignore-line no-empty
    else {
      A[p] = B[p];
    }
  }
  return A;
};

_.mergeUnsafe = function(A, B) {
  return _.mergeDeep(A, B, 0);
};

_.merge = function(A, B, depth) {
  var Acopy = _.mergeDeep({}, A);
  return _.mergeDeep(Acopy, B, depth);
};

module.exports = _;
class Patch {
  /** @param {string} x @param {(number | string)[]} _ */
  static apply(x, _) {
    var y = "";
    for (var i = 0; i < _.length; i++) {
      var $ = _[i];
      var z = _[i + 1];
      y += +$ === $ ? x.slice($, +z === z ? (++i, z) : undefined) : $;
    }
    return y;
  }

  /** @param {string} x @param {string} y */
  static diff(x, y) {
    if (y.length > x.length * 2) {
      return [y];
    }

    /** @type {(number | string)[]} */
    var _ = [];
    var off = 0;
    var dos = 1e4;

    main: for (var i = 0; i < x.length && i + off < y.length; i++) {
      if (x[i] === y[i + off]) {
        for (var j = i + 1; j < x.length; j++) {
          if (x[j] !== y[j + off]) {
            _.push(i, j);
            i = j - 1;
            continue main;
          }
          if (j + off === y.length - 1) {
            if (j === x.length - 1) {
              _.push(i);
            } else {
              _.push(i, j + 1);
            }
            return _;
          }
        }
        _.push(i, y.slice(x.length + off));
        return _;
      }

      var n = nextMatch(i);
      if (n != null) {
        if (n.m) {
          _.push(y.slice(i + off, i + off + n.m));
        }
        off += n.m - n.l;
        i += n.l - 1;
        continue;
      }

      var z = y.slice(i + off);
      var c = x.indexOf(z, i);
      _.push(x.slice(c) === z ? c : z);
      return _;
    }

    /** @param {number} $ */
    function nextMatch($) {
      for (var k = 0; k * 2 < x.length - $; k++) {
        for (var l = 0; l < k && dos > 0; l++) {
          var a = x.slice($ + l, x.length - k + l);
          for (var m = 0; m < y.length - off - x.length + k && --dos > 0; m++) {
            var b = y.slice($ + off + m, x.length - k + off + m);
            if (a === b) {
              return { l: l, m: m };
            }
          }
        }
      }
      return;
    }

    return y ? [y] : _;
  }
}

exports.Patch = Patch;

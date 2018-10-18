const { test } = require("gunit");
const { Patch } = require("./Patch");

test("diffs", t => {
  var $ = JSON.stringify;

  var x = '{ foo: "bar", baz: "qux" }';
  var y = '{ foo: "barrister", baz: "qux" }';
  t.is($(Patch.diff(x, y)), $([0, 11, "rister", 11]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux" }';
  y = '{ foo: "barrister", baz: "quxster" }';
  t.is($(Patch.diff(x, y)), $([0, 11, "rister", 11, 23, "ster", 23]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux" }';
  y = '{ foo: "bar" }';
  t.is($(Patch.diff(x, y)), $([0, 12, 24]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar" }';
  y = '{ foo: "jar" }';
  t.is($(Patch.diff(x, y)), $([0, 8, "j", 9]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux" }';
  y = '{ foo: "bar", baz: "qux" }';
  t.is($(Patch.diff(x, y)), $([0]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux" }';
  y = "";
  t.is($(Patch.diff(x, y)), $([]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux" ';
  y = '{ foo: "bar", baz: "qux" }';
  t.is($(Patch.diff(x, y)), $([0, "}"]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux" }';
  y = '{ foo: "bar", baz: "qux" ';
  t.is($(Patch.diff(x, y)), $([0, 25]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = "{";
  y = '{ foo: "bar", baz: "qux" }';
  t.is($(Patch.diff(x, y)), $(['{ foo: "bar", baz: "qux" }']));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = "";
  y = '{ foo: "bar", baz: "qux" }';
  t.is($(Patch.diff(x, y)), $(['{ foo: "bar", baz: "qux" }']));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "", baz: "qux" }';
  y = '{ foo: "bar", abc: "xyz", baz: "" }';
  t.is($(Patch.diff(x, y)), $([0, 8, 'bar", abc: "xyz', 8, 17, 20]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar", baz: "qux", abc: "xyz" }';
  y = '{ foo: "bar", abc: "xyz" }';
  t.is($(Patch.diff(x, y)), $([0, 14, 26]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = "renice";
  y = "renie";
  t.is($(Patch.diff(x, y)), $([0, 4, 5]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bad", baz: "qux" }';
  y = '{ foo: "bark", baz: "qux" }';
  t.is($(Patch.diff(x, y)), $([0, 10, "rk", 11]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);

  x = '{ foo: "bar" }';
  y = ' foo: "bar" }';
  t.is($(Patch.diff(x, y)), $([1]));
  t.is(Patch.apply(x, Patch.diff(x, y)), y);
});

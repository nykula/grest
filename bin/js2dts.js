#!/usr/bin/env node

const Ts = require("typescript");
const prog = Ts.createProgram(process.argv.slice(2), { allowJs: true });
const $ = prog.getTypeChecker();
/** @param {Ts.Symbol} x */
const typeOf = x => $.getTypeOfSymbolAtLocation(x, x.valueDeclaration);

prog.getSourceFiles().map(
  x =>
    !x.isDeclarationFile &&
    x.forEachChild(y => {
      if (Ts.isClassDeclaration(y) && y.name) {
        const s = $.getSymbolAtLocation(y.name);
        if (s) {
          // tslint:disable-next-line:no-console
          console.log(klass(s));
        }
      }
    })
);

/** @param {Ts.Symbol[]} xs */
function symbols(xs) {
  const methods = xs
    .filter(x => Ts.isFunctionLike(x.valueDeclaration))
    .map(
      x =>
        typeOf(x)
          .getCallSignatures()
          .map(y =>
            [
              x.getName(),
              $.signatureToString(y, undefined, Ts.TypeFormatFlags.NoTruncation)
            ].join("")
          )[0]
    )
    .sort();
  const props = xs
    .filter(x => !Ts.isFunctionLike(x.valueDeclaration))
    .filter(x => x.name[0] !== "_" && x.name !== "prototype")
    .map(y => `${y.name}: ${$.typeToString(typeOf(y))}`)
    .sort();
  return { methods, props };
}

/** @param {Ts.Symbol} x */
function klass(x) {
  /** @type {Ts.Symbol[]} */
  const members = [];
  if (x.members) {
    x.members.forEach(y => members.push(y));
  }
  const statics = symbols(typeOf(x).getProperties());
  const instance = symbols(members);
  return `export class ${x.getName()} {\n  ${[
    statics.props.map(y => `static ${y}`),
    statics.methods.map(y => `static ${y}`),
    instance.props,
    typeOf(x)
      .getConstructSignatures()
      .map(
        y =>
          `constructor${$.signatureToString(y)
            .split(":")
            .slice(0, -1)
            .join(":")}`
      )
      .filter(y => y !== "constructor()"),
    instance.methods
  ]
    .map(xs => xs.join("\n"))
    .join("\n")
    .replace(/(\n+)/g, "$1  ")
    .trim()}\n}`;
}

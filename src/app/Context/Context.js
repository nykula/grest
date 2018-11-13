require("../Byte/ByteString").require();
const { fromString, toString } = imports.byteArray;
const { DataInputStream } = imports.gi.Gio;
const GLib = imports.gi.GLib;
const { Message, Session, URI } = imports.gi.Soup;

class Context {
  /** @param {string} url @param {Partial<Context>?} [ctx] */
  static async fetch(url, ctx) {
    ctx = ctx || {};
    const headers = ctx.headers || {};
    const method = ctx.method || "GET";

    const msg = new Message({ method, uri: new URI(url) });
    for (const name of Object.keys(headers)) {
      const header = headers[name];
      if (header) {
        msg.request_headers.append(name, header);
      }
    }
    if (ctx.body !== undefined) {
      msg.request_body.append(fromString(JSON.stringify(ctx.body)));
    }

    const session = new Session();
    const response = await new Promise(resolve =>
      session.send_async(msg, null, (_, $) => resolve(session.send_finish($)))
    );
    const body = await new Promise(resolve => {
      const stream = new DataInputStream({ base_stream: response });
      stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_, $) => {
        const [maybe] = stream.read_line_finish($);
        resolve(maybe && maybe.length ? toString(maybe) : "null");
      });
    });

    const responseCtx = new Context();
    try {
      responseCtx.body = JSON.parse(body);
    } catch (_) {
      responseCtx.body = body;
    }
    responseCtx.status = msg.status_code;
    return responseCtx;
  }

  constructor(/** @type {any} */ props) {
    /** @type {any} */ this.body = {};
    /** @type {{ [key: string]: string | undefined }} */ this.headers = {};
    this.id = "";
    this.ip = "";
    this.length = 0;
    this.method = "GET";
    this.path = "";
    this.protocol = "HTTP/1.1";
    this.query = "";
    this.props = props;
    this.status = 200;
    this.userId = "";
  }

  toString() {
    const date = new Date();
    const d = `0${date.getUTCDate()}`.slice(-2);
    const m = "JanFebMarAprMayJunJulAugSepOctNovDec".substr(
      date.getUTCMonth() * 3,
      3
    );
    const Y = date.getUTCFullYear();
    const H = `0${date.getUTCHours()}`.slice(-2);
    const M = `0${date.getUTCMinutes()}`.slice(-2);
    const S = `0${date.getUTCSeconds()}`.slice(-2);
    return `${this.ip} - ${this.userId ||
      "-"} [${d}/${m}/${Y}:${H}:${M}:${S} +0000] ${JSON.stringify(
      `${this.method} ${this.path}${this.query ? `?${this.query}` : ""} ${
        this.protocol
      }`
    )} ${this.status} ${this.length} ${JSON.stringify(
      "Referer" in this.headers ? this.headers.Referer : "-"
    )} ${JSON.stringify(
      "User-Agent" in this.headers ? this.headers["User-Agent"] : "-"
    )}`;
  }
}
/** @type {(new () => any)[]} */ Context.watch = [];
exports.Context = Context;

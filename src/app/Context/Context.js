require("../Byte/ByteString").require();
const { fromString, toString } = imports.byteArray;
const { DataInputStream } = imports.gi.Gio;
const GLib = imports.gi.GLib;
const { Message, Session, URI } = imports.gi.Soup;

class Context {
  /**
   * @param {string} url
   * @param {Partial<Context>?} [ctx]
   */
  static async fetch(url, ctx) {
    ctx = ctx || {};

    const headers = ctx.headers || {};
    const method = ctx.method || "GET";

    const msg = new Message({
      method,
      uri: new URI(url)
    });

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

    const response = await new Promise((resolve, reject) => {
      session.send_async(msg, null, (_, asyncResult) => {
        /** @type {any} */
        let maybeResponse;

        try {
          maybeResponse = session.send_finish(asyncResult);
        } catch (error) {
          reject(error);

          return;
        }

        resolve(maybeResponse);
      });
    });

    const body = await new Promise((resolve, reject) => {
      const stream = new DataInputStream({ base_stream: response });

      stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_, asyncResult) => {
        /** @type {any} */
        let maybe;

        try {
          [maybe] = stream.read_line_finish(asyncResult);
        } catch (error) {
          reject(error);

          return;
        }

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
    /** @type {any} */
    this.body = {};
    /** @type {{ [key: string]: string | undefined }} */
    this.headers = {};
    this.id = "";
    this.ip = "";
    this.method = "GET";
    this.path = "";
    this.query = "";
    this.props = props;
    this.status = 200;
  }
}

/** @type {(new () => any)[]} */
Context.watch = [];

exports.Context = Context;

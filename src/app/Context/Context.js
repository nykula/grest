const { fromString } = imports.byteArray;
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
      if (headers[name]) {
        msg.request_headers.append(name, headers[name]);
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
        let maybeBody;

        try {
          [maybeBody] = stream.read_line_finish(asyncResult);
        } catch (error) {
          reject(error);

          return;
        }

        resolve(maybeBody.toString());
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

  constructor() {
    /** @type {any} */
    this.body = {};
    this.headers = {};
    this.method = "";
    this.path = "";
    this.query = "";
    this.status = 200;
  }
}

exports.Context = Context;

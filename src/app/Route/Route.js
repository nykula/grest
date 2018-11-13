require("../Byte/ByteString").require();
const { fromGBytes, toString } = imports.byteArray;
const GLib = imports.gi.GLib;
const { MemoryUse, Message, Server } = imports.gi.Soup;
const { Context } = require("../Context/Context");

class Route {
  /** @param {{ message?: string }} error */
  static error(error) {
    const message = error.message || "";
    const statusStr = message.replace(/^(\d+).*/, "$1");
    const status = Number(statusStr) || 500;

    return {
      message: statusStr ? message : `${status} ${message}`,
      status
    };
  }

  /** @param {Context} controller */
  static async runIfAllows(controller) {
    /** @type {any} */ const ctx = controller;
    const method = controller.method.toLowerCase();
    const O = Object;

    if (
      O.prototype.hasOwnProperty(method) ||
      !ctx[method] ||
      typeof ctx[method] !== "function"
    ) {
      if (method === "options") {
        controller.headers.Allow = O.getOwnPropertyNames(O.getPrototypeOf(ctx))
          .filter(
            x => typeof ctx[x] === "function" && !O.prototype.hasOwnProperty(x)
          )
          .map(x => x.toUpperCase())
          .concat("OPTIONS")
          .join(",");
        return;
      }
      throw new Error("405 Method Not Allowed");
    }

    await ctx[method]();
  }

  /** @param {Route[]} routes @param {any} services */
  static server(routes, services = {}) {
    const { pkg } = Route;
    const srv = new Server();

    /** @type {(error?: Error, ctx?: Context) => void} */
    const log =
      services.log ||
      ((x, y) =>
        (!y || y.method !== "OPTIONS") && x ? printerr(x, x.stack) : print(y));

    for (const route of routes) {
      srv.add_handler(route.path, async (_, msg, path, __, client) => {
        /** @type {Context} */ const ctx = new route.controller(services);
        const bytes = fromGBytes(msg.request_body_data);
        ctx.body = JSON.parse(bytes && bytes.length ? toString(bytes) : "null");
        ctx.ip = client.get_host() || "";
        ctx.method = msg.method;
        ctx.path = path;
        ctx.query = msg.get_uri().query || "";

        msg.request_headers.foreach(
          (name, value) => (ctx.headers[name] = value)
        );
        msg.response_headers.append("Access-Control-Allow-Origin", "*");
        msg.response_headers.append("Vary", "Origin");

        srv.pause_message(msg);

        try {
          await this.runIfAllows(ctx);
        } catch (error) {
          log(error);
          const { message, status } = Route.error(error);
          msg.set_status(status);
          msg.set_response(
            "text/plain",
            MemoryUse.COPY,
            /** @type {any} */ (message)
          );
          srv.unpause_message(msg);
          ctx.status = status;
          this.meta(msg, ctx);
          log(undefined, ctx);

          return;
        }

        const allow = ctx.headers.Allow;
        if (allow) {
          msg.response_headers.append("Access-Control-Allow-Methods", allow);
          msg.response_headers.append("Allow", allow);
        }
        msg.set_status(200);
        msg.set_response(
          "application/json",
          MemoryUse.COPY,
          /** @type {any} */ (JSON.stringify(ctx.body))
        );
        srv.unpause_message(msg);
        this.meta(msg, ctx);
        log(undefined, ctx);
      });
    }

    srv.add_handler(null, async (_, msg, __, ___, client) => {
      const ctx = new Context();
      ctx.ip = client.get_host() || "";
      msg.request_headers.foreach((name, value) => (ctx.headers[name] = value));
      if (msg.request_headers.get_one("Upgrade") === "websocket") {
        this.meta(msg, ctx);
        log(undefined, ctx);
        return;
      }

      /** @type {any} */ const examples = {};
      for (const route of routes) {
        examples[`GET ${route.path}`] = new route.controller(services).body;
      }

      msg.set_status(200);
      msg.set_response(
        "application/json",
        MemoryUse.COPY,
        /** @type {any} */ (JSON.stringify({
          app: {
            description: pkg.description,
            name: pkg.name,
            repository: pkg.private ? "." : pkg.repository,
            version: pkg.version
          },
          examples
        }))
      );
      this.meta(msg, ctx);
      log(undefined, ctx);
    });

    return srv;
  }

  /** @private @param {Message} msg @param {Context} ctx */
  static meta(msg, ctx) {
    ctx.length =
      msg.request_headers.get_content_length() +
      msg.request_body.length +
      msg.response_headers.get_content_length() +
      msg.response_body.length;
    ctx.method = msg.method;
    const uri = msg.get_uri();
    ctx.path = uri.path;
    ctx.query = uri.query || "";
    ctx.protocol = `HTTP/${msg.get_http_version().toFixed(1)}`;
  }

  constructor() {
    this.controller = Context;
    this.path = "";
  }
}
Route.pkg = require(GLib.get_current_dir() + "/package.json");
exports.Route = Route;

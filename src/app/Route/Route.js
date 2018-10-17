const { fromGBytes, toString } = imports.byteArray;
const GLib = imports.gi.GLib;
const { MemoryUse, Server } = imports.gi.Soup;
const { Context } = require("../Context/Context");

class Route {
  /**
   * @param {{ message?: string }} error
   */
  static error(error) {
    const message = error.message || "";
    const statusStr = message.replace(/^(\d+).*/, "$1");
    const status = Number(statusStr) || 500;

    return {
      message: statusStr ? message : `${status} ${message}`,
      status
    };
  }

  /**
   * @param {Context} request
   * @param {Context} ctx
   */
  static async handleRequest(request, ctx) {
    const response = new Context();
    ctx.ip = request.ip;
    response.method = ctx.method;

    response.id = ctx.id = request.id;
    response.path = ctx.path = request.path;
    response.query = ctx.query = request.query;

    try {
      await Route.exec(ctx);
      response.body = ctx.body;
    } catch (error) {
      const { message, status } = Route.error(error);
      response.body = /** @type {any} */ (message);
      response.status = status;
    }

    return response;
  }

  /**
   * @param {Route[]} routes
   */
  static server(routes, services = {}) {
    const { pkg } = Route;
    const srv = new Server();

    for (const route of routes) {
      srv.add_handler(route.path, async (_, msg, path, __, client) => {
        /** @type {Context} */
        const ctx = new route.controller(services);
        const bytes = fromGBytes(msg.request_body_data);
        ctx.body = JSON.parse(bytes.length ? toString(bytes) : "null");
        ctx.ip = client.get_host() || "";
        ctx.method = msg.method;
        ctx.path = path;
        ctx.query = msg.get_uri().query || "";

        msg.request_headers.foreach((name, value) => {
          ctx.headers[name] = value;
        });

        msg.response_headers.append("Access-Control-Allow-Origin", "*");
        msg.response_headers.append("Vary", "Origin");

        srv.pause_message(msg);

        try {
          await this.exec(ctx);
        } catch (error) {
          const { message, status } = Route.error(error);
          msg.set_status(status);
          msg.set_response(
            "text/plain",
            MemoryUse.COPY,
            /** @type {any} */ (message)
          );
          srv.unpause_message(msg);

          return;
        }

        msg.set_status(200);
        msg.set_response(
          "application/json",
          MemoryUse.COPY,
          /** @type {any} */ (JSON.stringify(ctx.body))
        );
        srv.unpause_message(msg);
      });
    }

    srv.add_handler(null, async (_, msg) => {
      if (msg.request_headers.get_one("Upgrade") === "websocket") {
        return;
      }

      /** @type {any} */
      const examples = {};

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
    });

    return srv;
  }

  /**
   * @private
   * @param {Context} ctx
   */
  static async exec(ctx) {
    /** @type {any} */
    const controller = ctx;
    const method = ctx.method.toLowerCase();

    if (
      Object.prototype.hasOwnProperty(method) ||
      !controller[method] ||
      typeof controller[method] !== "function"
    ) {
      throw new Error("405 Method Not Allowed");
    }

    await controller[method]();
  }

  constructor() {
    this.controller = Context;

    this.path = "";
  }
}

Route.pkg = require(GLib.get_current_dir() + "/package.json");

exports.Route = Route;

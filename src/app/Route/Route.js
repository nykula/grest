const { fromGBytes } = imports.byteArray;
const GLib = imports.gi.GLib;
const { MemoryUse, Server } = imports.gi.Soup;
const { Context } = require("../Context/Context");

class Route {
  /**
   * @param {Route[]} routes
   */
  static server(routes, services = {}) {
    const { pkg } = Route;
    const srv = new Server();

    for (const route of routes) {
      srv.add_handler(
        route.path,
        async (_, msg, path) => {
          /** @type {Context} */
          const ctx = new route.controller(services);

          ctx.body = JSON.parse(
            String(fromGBytes(msg.request_body_data)) || "null"
          );
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
          } catch (error) {
            printerr(error);
            printerr(error.stack);

            msg.set_status(
              Number((error.message || "").replace(/^(\d+).*/, "$1")) || 500
            );

            msg.set_response("text/plain", MemoryUse.COPY, error.message);
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
        },
        /** @type {any} */ (undefined) // Typings issue, ignore warning.
      );
    }

    srv.add_handler(
      null,
      async (_, msg) => {
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
      },
      /** @type {any} */ (undefined) // Typings issue, ignore warning.
    );

    return srv;
  }

  constructor() {
    /** @type {any} */
    this.controller = Function;

    this.path = "";
  }
}

Route.pkg = require(GLib.get_current_dir() + "/package.json");

exports.Route = Route;

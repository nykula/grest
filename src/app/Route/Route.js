const { fromGBytes } = imports.byteArray;
const GLib = imports.gi.GLib;
const { MemoryUse, Server } = imports.gi.Soup;
const { Context } = require("../Context/Context");

class Route {
  /**
   * @param {Route[]} routes
   */
  static server(routes) {
    const { pkg } = Route;
    const srv = new Server();

    for (const route of routes) {
      srv.add_handler(
        route.path,
        async (_, msg, path, query) => {
          /** @type {Context} */
          const ctx = new route.controller();

          ctx.body = JSON.parse(
            String(fromGBytes(msg.request_body_data)) || "null"
          );
          ctx.method = msg.method;
          ctx.path = path;
          ctx.query = /** @type {any} */ (query);

          msg.request_headers.foreach((name, value) => {
            ctx.headers[name] = value;
          });

          msg.response_headers.append("Access-Control-Allow-Origin", "*");
          msg.response_headers.append("Vary", "Origin");

          srv.pause_message(msg);

          try {
            if (ctx.method !== "GET" && ctx.method !== "POST") {
              throw new Error("MethodNotAllowed");
            }

            /** @type {any} */
            const controller = ctx;

            await controller[ctx.method.toLowerCase()]();
          } catch (error) {
            printerr(error);
            printerr(error.stack);

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
          examples[`GET ${route.path}`] = [new route.model()];
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

    /** @type {any} */
    this.model = Function;

    this.path = "";
  }
}

Route.pkg = require(GLib.get_current_dir() + "/package.json");

exports.Route = Route;

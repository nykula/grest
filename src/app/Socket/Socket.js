require("../Byte/ByteString").require();
const { fromGBytes, toString } = imports.byteArray;
const { Server, WebsocketConnection } = imports.gi.Soup;
const { Db } = require("../Db/Db");
const { Context } = require("../Context/Context");
const { Patch } = require("../Patch/Patch");
const { Route } = require("../Route/Route");

class Socket {
  /** @param {Server} App @param {Route[]} routes @param {{ db: Db }} services */
  static watch(App, routes, services) {
    /** @type {{ connection: WebsocketConnection, last: string, q: (() => Promise)[], request: Context, route: Route }[]} */
    const subscriptions = [];

    App.add_websocket_handler(null, null, null, (_, connection, __, client) => {
      const ip = client.get_host();

      connection.connect(
        "closed",
        () => {
          for (let i = subscriptions.length - 1; i >= 0; i--) {
            if (subscriptions[i].connection === connection) {
              subscriptions.splice(i, 1);
            }
          }
        }
      );

      connection.connect(
        "message",
        async (___, ____, gBytes) => {
          /** @type {Context} */
          const request = JSON.parse(toString(fromGBytes(gBytes)));
          const route = routes.find(x => x.path === request.path);

          if (!route) {
            connection.send_text(JSON.stringify(Socket.ok(request)));
            return;
          }

          request.ip = ip || "::1";
          const method = request.method.toLowerCase();

          if (method === "subscribe") {
            subscriptions.push({ connection, last: "", q: [], request, route });
            connection.send_text(JSON.stringify(Socket.ok(request)));
          } else if (method === "unsubscribe") {
            for (let i = subscriptions.length - 1; i >= 0; i--) {
              if (subscriptions[i].request.id === request.id) {
                subscriptions.splice(i, 1);
              }
            }
            connection.send_text(JSON.stringify(Socket.ok(request)));
          } else {
            const ctx = new route.controller(services);
            ctx.method = request.method;

            const response = await Socket.exec(request, ctx);
            connection.send_text(JSON.stringify(response));
          }
        }
      );
    });

    const $ = JSON.stringify;
    routes.map(route =>
      route.controller.watch.map(model =>
        services.db.repo(model).on("*", () =>
          subscriptions.forEach(sub => {
            if (sub.route !== route) {
              return;
            }
            this.push(sub.q, async () => {
              const { connection, last, request } = sub;
              const ctx = new route.controller(services);
              const resp = await Socket.exec(request, ctx);
              sub.last = $(resp).replace(/([[,{])"(.*?[^\\])":/g, "$1$2:");
              connection.send_text($([resp.id, ...Patch.diff(last, sub.last)]));
            });
          })
        )
      )
    );
  }

  /** @private @param {Context} request @param {Context} ctx */
  static async exec(request, ctx) {
    // Create from scratch, you can have private props in controller.
    const response = new Context();

    // SUBSCRIBE request has responses with same id but GET method ctx.
    response.id = ctx.id = request.id;
    response.method = ctx.method;

    ctx.body = request.body;
    ctx.headers = request.headers;
    ctx.ip = request.ip;
    ctx.path = request.path;
    ctx.query = request.query;

    try {
      await Route.runIfAllows(ctx);
      response.body = ctx.body;
    } catch (error) {
      const { message, status } = Route.error(error);
      response.body = /** @type {any} */ (message);
      response.status = status;
    }

    return response;
  }

  /** @private @param {(() => Promise)[]} q @param {() => Promise} x */
  static async push(q, x) {
    if (q.push(x) === 1) {
      while (q.length) {
        const _ = q[0];
        await _();
        q.shift();
      }
    }
  }

  /** @private @param {Context} request */
  static ok(request) {
    const response = new Context();
    response.id = request.id;
    response.method = request.method;
    response.path = request.path;
    response.query = request.query;
    return response;
  }
}
exports.Socket = Socket;

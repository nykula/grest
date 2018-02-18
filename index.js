#!/usr/bin/gjs

const { DataInputStream } = imports.gi.Gio;
const GLib = imports.gi.GLib;
const { MemoryUse, Message, Server, Session, URI } = imports.gi.Soup;

class Status {
  constructor() {
    this.crashers = 0;
    this.bugs = 0;
    this.issues = 0;
    this.newcomers = 0;
    this.mrs = 0;
  }
}

class StatusController {
  /**
   * @param {Context} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  async get() {
    const status = new Status();

    const pagination = "state=opened&per_page=100";

    [
      status.crashers,
      status.bugs,
      status.newcomers,
      status.issues,
      status.mrs
    ] = await Promise.all([
      this.count(`/issues?${pagination}&labels=1.+Crash`),
      this.count(`/issues?${pagination}&labels=1.+Bug`),
      this.count(`/issues?${pagination}&labels=4.+Newcomers`),
      this.count(`/issues?${pagination}`),
      this.count(`/merge_requests?${pagination}`)
    ]);

    this.ctx.body = [status];
  }

  /**
   * @private
   * @param {string} path
   */
  async count(path) {
    const base = "https://gitlab.gnome.org/api/v4/projects/GNOME%2Fgjs";

    const { body } = await Context.fetch(`${base}${path}`, {
      headers: {
        "Private-Token": GLib.getenv("GITLAB_TOKEN")
      }
    });

    return body.length;
  }
}

// Plumbing.

class Context {
  /**
   * @param {string} url
   * @param {Partial<Context>} ctx
   */
  static async fetch(url, ctx = {}) {
    const headers = ctx.headers || {};
    const method = ctx.method || "GET";

    const msg = new Message({
      method,
      uri: new URI(url)
    });

    for (const name of Object.keys(headers)) {
      msg.request_headers.append(name, headers[name]);
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

    ctx = new Context();
    ctx.body = JSON.parse(body);

    return ctx;
  }

  constructor() {
    /** @type {any} */
    this.body = {};
    this.headers = {};
    this.method = "";
    this.path = "";
    this.query = {};
  }
}

class Route {
  /**
   * @param {Route[]} routes
   */
  static server(routes) {
    const srv = new Server();

    for (const route of routes) {
      srv.add_handler(
        route.path,
        async (_, msg, path, query) => {
          const ctx = new Context();

          ctx.body = {};
          ctx.headers = {};
          ctx.method = msg.method;
          ctx.path = path;
          ctx.query = /** @type {any} */ (query);

          msg.request_headers.foreach((name, value) => {
            ctx.headers[name] = value;
          });

          srv.pause_message(msg);

          /** @type {any} */
          const controller = new route.controller(ctx);

          try {
            if (ctx.method !== "GET") {
              throw new Error("MethodNotAllowed");
            }

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
        /** @type {any} */ (undefined)
      );
    }

    return srv;
  }

  constructor() {
    /** @type {any} */
    this.controller = Function;
    this.path = "";
  }
}

// Entry.

const app = Route.server([{ path: "/statuses", controller: StatusController }]);

const port = Number(GLib.getenv("PORT"));
app.listen_all(port, 0);
print(`Listening on ${port}`);

app.run();

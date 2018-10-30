require("../Byte/ByteString").require();
const { fromGBytes, toString } = imports.byteArray;
const GLib = imports.gi.GLib;
const { Message, Session, WebsocketConnection } = imports.gi.Soup;
const { test } = require("gunit");
const { Product } = require("../../domain/Product/Product");
const { Context } = require("../Context/Context");
const { Db } = require("../Db/Db");
const { ProductController } = require("../Product/ProductController");
const { Query } = require("../Query/Query");
const { Patch } = require("../Patch/Patch");
const { Route } = require("../Route/Route");
const { Socket } = require("./Socket");

test("connects", async t => {
  const db = Db.connect("sqlite:example_socket");

  await new RepoExample(db, t).run();
});

test("connects memory", async t => {
  const db = Db.connect("sqlite::memory:");

  await new RepoExample(db, t).run();
});

test("watches, queueing publications", async t => {
  class Post {
    constructor() {
      this.xs = "";
    }
  }
  const db = Db.connect("sqlite::memory:");
  await db.execute(db.prepare("create table Post (xs text)")[0], null);

  class PostController extends Context {
    constructor() {
      super();
      this.body = [new Post()];
    }
    async get() {
      this.body = await db.repo(Post).get();
    }
    async patch() {
      await db.repo(Post).patch(this.body[0]);
    }
    async post() {
      await db.repo(Post).post(this.body);
    }
  }
  PostController.watch = [Post];
  const routes = [{ controller: PostController, path: "/posts" }];
  const services = { db };
  const App = Route.server(routes, services);
  Socket.watch(App, routes, services);
  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);
  await new Promise(resolve =>
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => (resolve(), false))
  );

  let socket = new WebsocketConnection();
  const s = new Session();
  /** @type {any} */ const msg = Message.new("GET", `ws://localhost:${port}/`);
  await new Promise(resolve =>
    s.websocket_connect_async(msg, null, null, null, (_, asyncResult) =>
      resolve((socket = s.websocket_connect_finish(asyncResult)))
    )
  );
  let last = "";
  await new Promise($ => {
    socket.connect(
      "message",
      (_, __, gBytes) => {
        const response = JSON.parse(toString(fromGBytes(gBytes)));
        if (response.method === "SUBSCRIBE") {
          $();
        } else if (0 in response) {
          last = Patch.apply(last, response.slice(1));
        }
      }
    );
    socket.send_text(
      JSON.stringify({
        id: "0",
        method: "SUBSCRIBE",
        path: "/posts",
        query: ""
      })
    );
  });

  socket.send_text(
    JSON.stringify({
      body: [{ xs: "" }],
      id: Math.random().toString(),
      method: "POST",
      path: "/posts",
      query: ""
    })
  );
  await new Promise(resolve =>
    GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      Math.floor(Math.random() * 200),
      () => (resolve(), false)
    )
  );

  const xs = "foobar bazqux fghi lorem ipsum dolor sit amet";
  for (let i = 0; i < xs.length; i++) {
    socket.send_text(
      JSON.stringify({
        body: [{ xs: xs.slice(0, i + 1) }],
        id: Math.random().toString(),
        method: "PATCH",
        path: "/posts",
        query: ""
      })
    );
    await new Promise(resolve =>
      GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        Math.floor(Math.random() * 200),
        () => (resolve(), false)
      )
    );
  }

  await new Promise(resolve =>
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => (resolve(), false))
  );
  t.is(
    // tslint:disable-next-line:no-eval
    JSON.stringify(eval(`(${last})`).body),
    JSON.stringify([{ xs: "foobar bazqux fghi lorem ipsum dolor sit amet" }])
  );
});

/**
 * Creates a "products" table with a few rows.
 *
 * @see https://developer.gnome.org/libgda/unstable/main_example.html
 */
class RepoExample {
  /**
   * @param {Db} db
   * @param {{ is<T>(a: T, b: T): void }} t
   */
  constructor(db, t) {
    this.db = db;
    this.firstSubscriptionId = "";
    /** @type {{ [id: string]: string }} */
    this.evs = Object.create(null);
    this.port = 8000 + Math.floor(Math.random() * 10000);
    this.socket = new WebsocketConnection();
    this.t = t;

    /** @type {typeof Context.fetch} */
    this.fetch = (path, init) =>
      new Promise(resolve => {
        const [pathname, query] = path.split("?");
        init = init || new Context();
        const { method } = init;

        const id = init.id || Math.random().toString();

        this.socket.connect(
          "message",
          (_, __, gBytes) => {
            const response = JSON.parse(toString(fromGBytes(gBytes)));

            if (response.id === id && response.method === method) {
              resolve(response);
            } else if (response[0] === id) {
              this.evs[id] = Patch.apply(this.evs[id] || "", response.slice(1));
            }
          }
        );

        this.socket.send_text(
          JSON.stringify({
            body: init.body,
            id,
            method,
            path: pathname,
            query: query || ""
          })
        );
      });
  }

  async run() {
    const routes = [
      { controller: ProductController, path: "/products" },
      { controller: ProductController, path: "/different-route" },
      { controller: ProductController, path: "/yet-another-route" }
    ];

    const services = { db: this.db };

    const App = Route.server(routes, services);
    Socket.watch(App, routes, services);

    App.listen_all(this.port, 0);

    const session = new Session();
    await new Promise(resolve =>
      session.websocket_connect_async(
        /** @type {any} */ (Message.new("GET", `ws://localhost:${this.port}/`)),
        null,
        null,
        null,
        (_, asyncResult) => {
          this.socket = session.websocket_connect_finish(asyncResult);
          resolve();
        }
      )
    );

    await this.createTable();

    const { id } = await this.fetch("/products", { method: "SUBSCRIBE" });
    this.firstSubscriptionId = id;

    // Still okay, does nothing.
    await this.fetch("/nonexistent-route", { method: "SUBSCRIBE" });

    await this.insertProducts();

    // Not earlier, to verify that one works as well as many.
    const altId = (await this.fetch("/different-route", {
      method: "SUBSCRIBE"
    })).id;

    await this.fetch("/yet-another-route", { method: "SUBSCRIBE" });

    await this.updateWhereIdP1000();
    await this.deleteWhereTableOrFree();

    await this.fetch("/products", { id, method: "UNSUBSCRIBE" });
    await this.fetch("/products", { id: altId, method: "UNSUBSCRIBE" });

    // /yet-another-route unsubscribes itself.
    this.socket.close(0, null);

    this.db.connection.close();
  }

  /**
   * @private
   */
  async createTable() {
    let [statement] = this.db.prepare(`drop table if exists ${Product.name}`);

    await this.db.execute(statement, null);

    [statement] = this.db.prepare(`
      create table ${Product.name} (
        id varchar(64) not null primary key,
        name varchar(64) not null,
        price real
      )
    `);

    await this.db.execute(statement, null);
  }

  /**
   * @private
   */
  async deleteWhereTableOrFree() {
    await Promise.all([
      this.fetch("/products?name=eq.table", { method: "DELETE" }),
      this.fetch("/products?price=eq.0", { method: "DELETE" })
    ]);

    this.t.is(
      await this.displayProducts(),
      JSON.stringify([
        { id: "p1", name: "chair", price: 2.0 },
        { id: "p3", name: "glass", price: 1.1 },
        { id: "p1000", name: "flowers", price: 1.99 }
      ])
    );

    {
      const { body, status } = await this.fetch("/products?id=p3", {
        method: "DELETE"
      });
      this.t.is(String(body), "403 Forbidden Delete Not By Name Or Price");
      this.t.is(status, 403);
    }

    {
      const { body, status } = await this.fetch("/products?name=eq.table", {
        method: "toString"
      });
      this.t.is(String(body), "405 Method Not Allowed");
      this.t.is(status, 405);
    }

    this.t.is(
      (await this.fetch("/products?price=eq.0", {
        method: "body"
      })).status,
      405
    );

    this.t.is(
      (await this.fetch("/products?id=p3", {
        method: "constructor"
      })).status,
      405
    );
  }

  /**
   * @private
   */
  async displayProducts() {
    const products = JSON.stringify((await this.fetch("/products")).body);

    this.t.is(
      // tslint:disable-next-line:no-eval
      JSON.stringify(eval(`(${this.evs[this.firstSubscriptionId]})`).body),
      products
    );

    return products;
  }

  /**
   * @private
   */
  async insertProducts() {
    await this.fetch("/products", {
      body: [
        { id: "p1", name: "chair", price: 2.0 },
        { id: "p2", name: "table", price: 5 },
        { id: "p3", name: "glass", price: 1.1 },

        // Won't do nulls, GDA_TYPE_NULL isn't usable through introspection.
        { id: "p1000", name: "???", price: 0.0 },
        { id: "p1001", name: "???", price: 0 }
      ],

      method: "POST"
    });

    this.t.is(
      await this.displayProducts(),
      JSON.stringify([
        { id: "p1", name: "chair", price: 2 },
        { id: "p2", name: "table", price: 5 },
        { id: "p3", name: "glass", price: 1.1 },
        { id: "p1000", name: "???", price: 0 },
        { id: "p1001", name: "???", price: 0 }
      ])
    );
  }

  /**
   * @private
   */
  async updateWhereIdP1000() {
    // Kitchen sink.
    const { id } = await this.fetch(
      `/products?${Query.of(Product)
        .name.not.in(["flowers"])
        .order.price.desc()
        .limit(3)
        .offset(1)}`,
      { method: "SUBSCRIBE" }
    );

    await this.fetch("/products?id=eq.p1000", {
      body: [{ name: "flowers", price: 1.99 }],
      method: "PATCH"
    });

    this.t.is(
      await this.displayProducts(),
      JSON.stringify([
        { id: "p1", name: "chair", price: 2.0 },
        { id: "p2", name: "table", price: 5.0 },
        { id: "p3", name: "glass", price: 1.1 },
        { id: "p1000", name: "flowers", price: 1.99 },
        { id: "p1001", name: "???", price: 0.0 }
      ])
    );

    await new Promise(resolve =>
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => (resolve(), false))
    );

    // Kitchen sink continues.
    this.t.is(
      // tslint:disable-next-line:no-eval
      eval(`(${this.evs[id]})`)
        .body.map((/** @type {Product} */ x) => x.id)
        .join(","),
      "p1,p3,p1001"
    );

    await this.fetch("/products", { id, method: "UNSUBSCRIBE" });
  }
}

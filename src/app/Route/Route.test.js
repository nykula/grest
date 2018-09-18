const { test } = require("gunit");
const { Context } = require("../Context/Context");
const { Db } = require("../Db/Db");
const { Query } = require("../Query/Query");
const { Route } = require("./Route");

test("connects", async t => {
  const db = Db.connect("sqlite:example_route");

  await new RepoExample(db, t).run();
});

test("connects memory", async t => {
  const db = Db.connect("sqlite::memory:");

  await new RepoExample(db, t).run();
});

class Product {
  constructor() {
    this.id = "";
    this.name = "";
    this.price = 0;
  }
}

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
    this.port = 8000 + Math.floor(Math.random() * 10000);
    this.t = t;

    /** @type {typeof Context.fetch} */
    this.fetch = (path, init) =>
      Context.fetch(`http://localhost:${this.port}${path}`, init);
  }

  async run() {
    const self = this;

    class ProductService {
      constructor() {
        this.repo = self.db.repo(Product);
      }
    }

    class ProductController extends Context {
      constructor(/** @type {{ productService: ProductService }} */ props) {
        super();

        /** @type {Product[]} */
        this.body = [new Product()];

        this.repo = props.productService.repo;
      }

      async delete() {
        if (!/^(name|price)=eq\.[a-z0-9-]+$/.test(this.query)) {
          throw new Error("403 Forbidden Delete Not By Name Or Price");
        }

        await this.repo.delete().parse(this.query);
      }

      async get() {
        this.body = await this.repo.get().parse(this.query);
      }

      async patch() {
        await this.repo.patch(this.body[0]).parse(this.query);
      }

      async post() {
        await this.repo.post(this.body);
      }
    }

    // Literals are okay. Constructor works too.
    const productRoute = new Route();
    productRoute.controller = ProductController;
    productRoute.path = "/products";

    const services = { productService: new ProductService() };
    Route.server([productRoute], services).listen_all(this.port, 0);

    await this.createTable();

    await this.insertProducts();

    // Tests cache.
    await this.displayProducts();

    await this.updateWhereIdP1000();

    await this.deleteWhereTableOrFree();

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
      this.t.is(body.toString(), "403 Forbidden Delete Not By Name Or Price");
      this.t.is(status, 403);
    }

    {
      const { body, status } = await this.fetch("/products?name=eq.table", {
        method: "toString"
      });
      this.t.is(body.toString(), "405 Method Not Allowed");
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
    return JSON.stringify((await this.fetch("/products")).body);
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

    // Kitchen sink.
    this.t.is(
      (await this.fetch(
        `/products?${Query.of(Product)
          .name.not.in(["flowers"])
          .order.price.desc()
          .limit(3)
          .offset(1)}`
      )).body
        .map((/** @type {Product} */ x) => x.id)
        .join(","),
      "p1,p3,p1001"
    );
  }
}

const { test } = require("gunit");
const { Db } = require("../Db/Db");
const { Repo } = require("./Repo");

test("connects", async t => {
  const db = Db.connect("sqlite:repo_example_db");

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
    this.connection = db.connection;

    this.db = db;

    this.t = t;
  }

  async run() {
    await this.createTable();

    await this.insertProducts();

    await this.displayProducts();

    await this.updateWhereIdP1000();

    await this.deleteWhereTableOrFree();

    this.connection.close();
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
    const repo = Repo.of(this.db, Product);

    await Promise.all([
      repo.delete().name.eq("table"),
      repo.delete().price.eq(0)
    ]);

    this.t.is(
      await this.displayProducts(),
      `id    │ name    │ price
      ──────┼─────────┼─────────
      p1    │ chair   │ 2.000000
      p3    │ glass   │ 1.100000
      p1000 │ flowers │ 1.990000
      (3 rows)`
    );
  }

  /**
   * @private
   */
  async displayProducts() {
    const repo = Repo.of(this.db, Product);

    const products = await repo.get();
    const keys = Object.keys(products[0]);

    /** @type {any[]} */
    const xs = products;
    const length = keys.map(
      (key, i) =>
        xs
          .map(x => (i === keys.length - 1 ? x[key].toFixed(6) : x[key]))
          .sort((a, b) => b.length - a.length)[0].length
    );

    // Test compares the value with a trimmed indented string.
    return [
      keys
        .map((k, i) => (i === keys.length - 1 ? k : k.padEnd(length[i], " ")))
        .join(" │ ")
    ]
      .concat(keys.map((_, i) => "".padEnd(length[i], "─")).join("─┼─"))
      .concat(
        xs.map(product =>
          keys
            .map(
              (key, i) =>
                i === keys.length - 1
                  ? product[key].toFixed(6)
                  : product[key].padEnd(length[i], " ")
            )
            .join(" │ ")
        )
      )
      .concat([`(${products.length} rows)`])
      .join("\n      ");
  }

  /**
   * @private
   */
  async insertProducts() {
    const repo = Repo.of(this.db, Product);

    await repo.post([
      { id: "p1", name: "chair", price: 2.0 },
      { id: "p2", name: "table", price: 5 },
      { id: "p3", name: "glass", price: 1.1 },

      // Won't do nulls, GDA_TYPE_NULL isn't usable through introspection.
      { id: "p1000", name: "???", price: 0.0 },
      { id: "p1001", name: "???", price: 0 }
    ]);

    this.t.is(
      await this.displayProducts(),
      `id    │ name  │ price
      ──────┼───────┼─────────
      p1    │ chair │ 2.000000
      p2    │ table │ 5.000000
      p3    │ glass │ 1.100000
      p1000 │ ???   │ 0.000000
      p1001 │ ???   │ 0.000000
      (5 rows)`
    );
  }

  /**
   * @private
   */
  async updateWhereIdP1000() {
    const repo = Repo.of(this.db, Product);

    await repo.patch({ name: "flowers", price: 1.99 }).id.eq("p1000");

    this.t.is(
      await this.displayProducts(),
      `id    │ name    │ price
      ──────┼─────────┼─────────
      p1    │ chair   │ 2.000000
      p2    │ table   │ 5.000000
      p3    │ glass   │ 1.100000
      p1000 │ flowers │ 1.990000
      p1001 │ ???     │ 0.000000
      (5 rows)`
    );

    // Kitchen sink.
    this.t.is(
      (await repo
        .get()
        .name.not.in(["flowers"])
        .order.price.desc()
        .limit(3)
        .offset(1))
        .map(x => x.id)
        .join(","),
      "p1,p3,p1001"
    );
  }
}

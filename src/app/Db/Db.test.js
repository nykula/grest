const { DataModel, HandlerNumerical } = imports.gi.Gda;
const { test } = require("gunit");
const { Db } = require("./Db");

test("connects", async t => {
  const db = Db.connect("sqlite:example_db");

  await new DbExample(db, t).run();
});

test("connects memory", async t => {
  const db = Db.connect("sqlite::memory:");

  await new DbExample(db, t).run();
});

/**
 * Creates a "products" table with a few rows.
 *
 * @see https://developer.gnome.org/libgda/unstable/main_example.html
 */
class DbExample {
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
    let [statement] = this.db.prepare("drop table if exists products");

    await this.db.execute(statement, null);

    [statement] = this.db.prepare(`
      create table products (
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
    const [statement, parameters] = this.db.prepare(`
      delete from products where
        name = ##name::gchararray or
        price = ##price::gint
    `);

    parameters.get_holder("name").set_value("table");
    parameters.get_holder("price").set_value(0);

    await this.db.execute(statement, parameters);

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
    const [statement] = this.db.prepare(`
      select id, name, price from products
    `);

    /** @type {[DataModel, any]} */
    const [rows] = await this.db.execute(statement, null);

    // Test compares the value with an trimmed indented string.
    return String(rows.dump_as_string())
      .trim()
      .split("\n")
      .map(x => `      ${x.trim()}`)
      .join("\n")
      .trim();
  }

  /**
   * @private
   */
  async insertProducts() {
    const [statement, parameters] = this.db.prepare(`
      insert into products(id, name, price) values(
        ##id::gchararray,
        ##name::gchararray,
        ##price::gdouble
      )
    `);

    for (const [id, name, price] of [
      ["p1", "chair", 2.0],
      ["p2", "table", 5],
      ["p3", "glass", 1.1],

      // Won't do nulls, GDA_TYPE_NULL isn't usable through introspection.
      ["p1000", "???", 0.0],
      ["p1001", "???", 0]
    ]) {
      parameters.get_holder("id").set_value(id);
      parameters.get_holder("name").set_value(name);

      /**
       * Can't pass an integer from JS to a `gdouble`, e.g. 1.1 is fine
       * but not 0.0, 2.0 or 5.
       */
      parameters
        .get_holder("price")
        .set_value_str(new HandlerNumerical(), String(price));

      await this.db.execute(statement, parameters);
    }

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
    const [statement, parameters] = this.db.prepare(`
      update products
      set
        name = ##name::gchararray,
        price = ##price::gdouble
      where
        id = ##id::gchararray
    `);

    parameters.get_holder("id").set_value("p1000");
    parameters.get_holder("name").set_value("flowers");
    parameters.get_holder("price").set_value(1.99);

    await this.db.execute(statement, parameters);

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
  }
}

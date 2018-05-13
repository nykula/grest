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
 * Creates a "products" table, adds a few rows to it, and displays its contents.
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
    this.createTable();

    this.insertProducts();

    await this.displayProducts();

    this.connection.close();
  }

  /**
   * @private
   */
  createTable() {
    let statement = this.db.prepare("drop table if exists products");

    this.connection.statement_execute_non_select(statement, null);

    statement = this.db.prepare(`
      create table products (
        id varchar(64) not null primary key,
        name varchar(64) not null,
        price real
      )
    `);

    this.connection.statement_execute_non_select(statement, null);
  }

  /**
   * @private
   */
  deleteWhereTableOrFree() {
    this.connection.delete_row_from_table("products", "name", "table");

    this.connection.delete_row_from_table("products", "price", 0)
  }

  /**
   * @private
   */
  async displayProducts() {
    const sql = "select id, name, price from products";

    const statement = this.db.prepare(sql);

    const result = await this.db.execute(statement);

    this.t.is(result[0].dump_as_string().split("\n").length, 9);
  }

  /**
   * @private
   */
  insertProducts() {
    const data = [
      ["p1", "chair", 2.0],
      ["p2", "table", 5.0],
      ["p3", "glass", 1.1],

      // Won't do nulls, GDA_TYPE_NULL isn't usable through introspection.
      ["p1000", "???", 0.],
      ["p1001", "???", 0]
    ].map(([id, name, price]) => ({
      id,
      name,
      price
    }));

    for (const { id, name, price } of data) {
      this.connection.insert_row_into_table_v(
        "products",
        ["id", "name", "price"],
        [id, name, price]
      );
    }
  }

  /**
   * @private
   */
  updateWhereIdP1000() {
    this.connection.update_row_in_table_v(
      "products",
      "id",
      "p1000",
      ["name", "price"],
      ["flowers", 1.99]
    );
  }
}
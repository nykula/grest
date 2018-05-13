const { Connection, ConnectionOptions, SqlParser, Statement, StatementModelUsage } = imports.gi.Gda;
const GLib = imports.gi.GLib;
const { URI } = imports.gi.Soup;

class Db {
  /**
   * @param {string} uri
   */
  static connect(uri) {
    const { host, password, path, port, query, scheme, user } = new URI(uri);

    // Will mostly receive names, but let's allow absolute paths if needed.
    const name = path.replace(/[^/]/g, "").length === 1 ? path.replace(/^\//, "") : path;

    const connection = Connection.open_from_string(
      scheme.replace("sql", "SQL"),
      `HOST=${host};PORT=${port};DB_NAME=${name};${query}`,
      `USERNAME=${user};PASSWORD=${password}`,
      ConnectionOptions.THREAD_ISOLATED,
    );

    return new Db(connection)
  }

  /**
   * @param {Connection} connection
   */
  constructor(connection) {
    imports.gi.Gda.init();

    /** @type {(() => void)[]} */
    this.callbacks = [];

    this.connection = connection;

    this.GLib = GLib;

    this.parser = this.connection.create_parser() || new SqlParser();

    this.pollInterval = 50;

    this.GLib.timeout_add(GLib.PRIORITY_LOW, this.pollInterval, () => {
      for (const callback of this.callbacks) {
        callback();
      }

      return this.connection.is_opened();
    });
  }

  /**
   * @param {Statement} statement
   */
  async execute(statement) {
    /** @type {any} Expected type GType for Argument. */
    const colTypes = null;

    const id = this.connection.async_statement_execute(
      statement,
      null,
      StatementModelUsage.RANDOM_ACCESS,
      colTypes,
      false
    );

    /** @type {[any, any]} */
    const result = await new Promise(resolve => {
      const callback = () => {
        const _ = this.connection.async_fetch_result(id);

        if (!_ || !_[0]) {
          return;
        }

        for (let i = this.callbacks.length - 1; i >= 0; i--) {
          if (this.callbacks[i] === callback) {
            this.callbacks.splice(i, 1);
            break;
          }
        }

        resolve(_);
      };

      this.callbacks.push(callback);
    })

    return result;
  }

  /**
   * @param {string} sql 
   * @returns {Statement}
   */
  prepare(sql) {
    /** @type {any} */
    const statement = this.parser.parse_string(sql)[0];

    return statement;
  }
}

exports.Db = Db;
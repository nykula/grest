const {
  Connection,
  ConnectionOptions,
  Set,
  SqlParser,
  Statement,
  StatementModelUsage
} = imports.gi.Gda;
const GLib = imports.gi.GLib;
const { URI } = imports.gi.Soup;

/**
 * Prepares and executes statements in a Libgda connection.
 */
class Db {
  /**
   * @param {string} uri
   */
  static connect(uri) {
    const { host, password, path, port, query, scheme, user } = new URI(uri);

    // Will mostly receive names, but let's allow absolute paths if needed.
    const name =
      path.replace(/[^/]/g, "").length === 1 ? path.replace(/^\//, "") : path;

    const connection = Connection.open_from_string(
      scheme.replace("sql", "SQL"),
      `HOST=${host};PORT=${port};DB_NAME=${name};${query}`,
      `USERNAME=${user};PASSWORD=${password}`,
      ConnectionOptions.THREAD_ISOLATED
    );

    return new Db(connection);
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
   * @param {Set | null} parameters
   */
  async execute(statement, parameters) {
    /** @type {any} Expected type GType for Argument. */
    const colTypes = null;

    const id = this.connection.async_statement_execute(
      statement,
      parameters,
      StatementModelUsage.RANDOM_ACCESS,
      colTypes,
      true
    );

    /** @type {[any, Set | null]} */
    const result = await new Promise(resolve => {
      const callback = () => {
        const _ = this.connection.async_fetch_result(id);

        if (!_[0] && !_[1]) {
          // Still processing.
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
    });

    return result;
  }

  /**
   * @param {string} sql
   * @returns {[Statement, Set]}
   */
  prepare(sql) {
    /** @type {any} */
    const statement = this.parser.parse_string(sql)[0];
    const parameters = statement.get_parameters()[1];

    return [statement, parameters];
  }
}

exports.Db = Db;

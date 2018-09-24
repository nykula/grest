const { DataModel, HandlerNumerical, Set, Statement } = imports.gi.Gda;
const { Query } = require("../Query/Query");

class Repo {
  /**
   * @param {IDb} db
   * @param {new () => any} model
   */
  static of(db, model) {
    const repo = new Repo(db, model);

    return {
      delete: () =>
        Repo.thenify(Query.of(model), iQuery => repo.delete(iQuery)),

      get: () => Repo.thenify(Query.of(model), iQuery => repo.get(iQuery)),

      patch: (/** @type {any} */ diff) =>
        Repo.thenify(Query.of(model), iQuery => repo.patch(diff, iQuery)),

      on: (/** @type {"*"} */ _, /** @type {() => void} */ callback) =>
        repo.callbacks.push(callback),

      post: (/** @type {any[]} */ entities) => repo.post(entities),

      repo
    };
  }

  /**
   * @template TResult
   * @template TTarget
   * @param {TTarget} target
   * @param {(target: TTarget) => Promise<TResult>} $promise
   */
  static thenify(target, $promise) {
    return Object.assign(target, {
      then: (/** @type {(result: TResult | Promise<any>) => any} */ callback) =>
        $promise(target)
          .then(callback)
          .catch(error => callback(Promise.reject(error)))
    });
  }

  /**
   * @param {IDb} db
   * @param {new () => any} model
   */
  constructor(db, model) {
    this.db = db;
    this.model = model;

    /** @type {(() => void)[]} */
    this.callbacks = [];

    this.entity = new this.model();
    this.keys = Object.keys(this.entity);

    this.fetchedAt = Object.create(null);
    this.garbageFactor = 2;
    this.maxCaches = 1e4;
    this.results = Object.create(null);
    const get = this.get.bind(this);
    Object.assign(this, {
      get: (/** @type {{ query: Query }} */ props) => {
        const { query } = props;
        const qStr = query.toString();

        if (this.results[qStr]) {
          return Promise.resolve(this.results[qStr]);
        }

        this.fetchedAt[qStr] = Date.now();
        const keys = Object.keys(this.fetchedAt);
        const undefs = keys
          .sort(
            (a, b) => this.fetchedAt[b].fetchedAt - this.fetchedAt[a].fetchedAt
          )
          .splice(this.maxCaches)
          .map(q => (this.results[q] = undefined)).length;

        if (keys.length + undefs >= this.maxCaches * this.garbageFactor) {
          const fetchedAt = Object.create(null);
          const results = Object.create(null);

          for (const q of keys) {
            const result = this.results[q];

            if (result) {
              fetchedAt[q] = this.fetchedAt[q];
              results[q] = result;
            }
          }

          this.fetchedAt = fetchedAt;
          this.results = results;
        }

        return (this.results[qStr] = get(props));
      }
    });
  }

  /**
   * @param {{ query: Query }} props
   */
  async delete(props) {
    const { query } = props;
    const { inject, toNative } = this.holdParameters();
    const [statement, parameters] = this.db.prepare(
      [
        `delete from ${this.model.name}`,
        this.where(query, toNative),
        this.order(query),
        this.limit(query)
      ]
        .filter(Boolean)
        .join(" ")
    );

    await this.db.execute(statement, inject(parameters));

    this.emit("delete");
  }

  /**
   * @param {"delete" | "patch" | "post"} _
   */
  emit(_) {
    this.fetchedAt = Object.create(null);
    this.results = Object.create(null);

    for (const callback of this.callbacks) {
      callback();
    }
  }

  /**
   * @param {{ query: Query }} props
   */
  async get(props) {
    const { query } = props;
    const { inject, toNative } = this.holdParameters();
    const [statement, parameters] = this.db.prepare(
      [
        `select ${this.keys.join(",")} from ${this.model.name}`,
        this.where(query, toNative),
        this.order(query),
        this.limit(query),
        this.offset(query)
      ]
        .filter(Boolean)
        .join(" ")
    );

    /** @type {[DataModel, any]} */
    const [rows] = await this.db.execute(statement, inject(parameters));
    const iter = rows.create_iter();

    /** @type {any[]} */
    const entities = [];

    while (iter.move_next()) {
      const entity = new this.model();

      for (const key of this.keys) {
        entity[key] = iter.get_value_for_field(key);
      }

      entities.push(entity);
    }

    return entities;
  }

  /**
   * @param {any} diff
   * @param {{ query: Query }} props
   */
  async patch(diff, props) {
    const { inject, toNative } = this.holdParameters();

    const [statement, parameters] = this.db.prepare(`
      update ${this.model.name}
      set ${this.keys
        .map(key => (key in diff ? `${key}=${toNative(diff[key])}` : undefined))
        .filter(Boolean)
        .join(",")}
      ${this.where(props.query, toNative)}
    `);

    await this.db.execute(statement, inject(parameters));

    this.emit("patch");
  }

  /**
   * @param {any[]} entities
   */
  async post(entities) {
    const { inject, toNative } = this.holdParameters();

    const [statement, parameters] = this.db.prepare(`
      insert into ${this.model.name}(${this.keys.join(",")})
      values ${entities
        .map(x => `(${this.keys.map(key => toNative(x[key])).join(",")})`)
        .join(",")}
    `);

    await this.db.execute(statement, inject(parameters));

    this.emit("post");
  }

  /**
   * @private
   */
  holdParameters() {
    /** @type {{ [id: string]: number | string }} */
    const holders = Object.create(null);
    let i = 0;

    const inject = (/** @type {Set} */ parameters) => {
      for (const id of Object.keys(holders)) {
        const value = holders[id];
        const holder = parameters.get_holder(id);

        if (typeof value === "string") {
          holder.set_value(value);
        } else {
          holder.set_value_str(new HandlerNumerical(), String(value));
        }
      }

      return parameters;
    };

    const toNative = (/** @type {boolean | number | string} */ value) => {
      const native = typeof value === "string" ? "gchararray" : "gdouble";
      holders[++i] = typeof value === "string" ? value : Number(value);
      return `##${i}::${native}`;
    };

    return { inject, toNative };
  }

  /**
   * @private
   * @param {Query} query
   */
  limit(query) {
    return query.limit ? `limit ${query.limit}` : undefined;
  }

  /**
   * @private
   * @param {Query} query
   */
  offset(query) {
    return query.offset ? `offset ${query.offset}` : undefined;
  }

  /**
   * @private
   * @param {Query} query
   */
  order(query) {
    return query.order.length
      ? `order by ${query.order.map(x => `${x.key} ${x.type}`).join(",")}`
      : undefined;
  }

  /**
   * @private
   * @param {Query} query
   * @param {(value: boolean | number | string) => string} toNative
   */
  where(query, toNative) {
    if (!query.filters.length) {
      return "";
    }

    const where = `where ${query.filters
      .map(
        ({ key, type, values }) =>
          `(${key}${
            {
              eq: "=",
              gte: ">=",
              in: " in",
              lte: "<=",
              "not.eq": "!=",
              "not.gte": "<",
              "not.in": " not in",
              "not.lte": ">"
            }[type]
          }(${values.map(toNative).join(",")}))`
      )
      .join("and ")}`;

    return where;
  }
}

/**
 * @typedef IDb
 * @property {(stmt: Statement, params: Set | null) => Promise<[any, Set | null]>} execute
 * @property {(sql: string) => [Statement, Set]} prepare
 */

exports.Repo = Repo;

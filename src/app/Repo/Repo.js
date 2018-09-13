const { DataModel, HandlerNumerical, Set } = imports.gi.Gda;
const { Db } = require("../Db/Db");
const { Query } = require("../Query/Query");

class Repo {
  /**
   * @param {Db} db
   * @param {new () => any} model
   */
  static of(db, model) {
    return {
      delete: () =>
        Repo.thenify(Query.of(model), iQuery =>
          new Repo(db, model).delete(iQuery)
        ),

      get: () =>
        Repo.thenify(Query.of(model), iQuery =>
          new Repo(db, model).get(iQuery)
        ),

      patch: (/** @type {any} */ diff) =>
        Repo.thenify(Query.of(model), iQuery =>
          new Repo(db, model).patch(diff, iQuery)
        ),

      post: (/** @type {any[]} */ entities) =>
        new Repo(db, model).post(entities)
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
      then: (/** @type {(result: TResult) => any} */ callback) =>
        new Promise(async (_, reject) => {
          let result;

          try {
            result = await $promise(target);
          } catch (error) {
            reject(error);
            return;
          }

          callback(result);
          _();
        })
    });
  }

  /**
   * @param {Db} db
   * @param {new () => any} model
   */
  constructor(db, model) {
    this.db = db;
    this.model = model;

    this.entity = new this.model();
    this.keys = Object.keys(this.entity);
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
      return;
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

exports.Repo = Repo;

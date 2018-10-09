/** @typedef {boolean | number | string} Value */

class Query {
  /**
   * @template T
   * @param {new () => T} model
   */
  static of(model) {
    const example = new model();

    const query = new Query();

    const iQuery = {
      query,

      /** @type {{ [key: string]: { asc(): void, desc(): void } }} */
      order: {},

      limit: (/** @type {number} */ value) => ((query.limit = value), iQuery),

      offset: (/** @type {number} */ value) => ((query.offset = value), iQuery),

      parse: (/** @type {string} */ $query) => (query.parse($query), iQuery),

      toString() {
        return query.toString();
      }
    };

    for (const key of Object.keys(example)) {
      iQuery.order[key] = {
        asc: () => (query.order.push({ key, type: "asc" }), iQuery),

        desc: () => (query.order.push({ key, type: "desc" }), iQuery)
      };

      /** @type {any} */ (iQuery)[key] = {
        eq: (/** @type {Value} */ value) => (
          query.filters.push({
            key,
            type: "eq",
            values: [value]
          }),
          iQuery
        ),

        gte: (/** @type {Value} */ value) => (
          query.filters.push({
            key,
            type: "gte",
            values: [value]
          }),
          iQuery
        ),

        in: (/** @type {(Value)[]} */ values) => (
          query.filters.push({
            key,
            type: "in",
            values
          }),
          iQuery
        ),

        lte: (/** @type {Value} */ value) => (
          query.filters.push({
            key,
            type: "lte",
            values: [value]
          }),
          iQuery
        ),

        not: {
          eq: (/** @type {Value} */ value) => (
            query.filters.push({
              key,
              type: "not.eq",
              values: [value]
            }),
            iQuery
          ),

          gte: (/** @type {Value} */ value) => (
            query.filters.push({
              key,
              type: "not.gte",
              values: [value]
            }),
            iQuery
          ),

          in: (/** @type {(Value)[]} */ values) => (
            query.filters.push({
              key,
              type: "not.in",
              values
            }),
            iQuery
          ),

          lte: (/** @type {Value} */ value) => (
            query.filters.push({
              key,
              type: "not.lte",
              values: [value]
            }),
            iQuery
          )
        }
      };
    }

    return iQuery;
  }

  constructor() {
    /** @type {{ key: string, type: "eq" | "not.eq" | "gte" | "not.gte" | "in" | "not.in" | "lte" | "not.lte", values: Value[] }[]} */
    this.filters = [];

    this.limit = 0;

    this.offset = 0;

    /** @type {{ key: string, type: "asc" | "desc" }[]} */
    this.order = [];
  }

  /**
   * @param {string} $query
   */
  parse($query) {
    for (const $ of $query.split("&")) {
      const [key, $parts] = $.split(/=/);

      if (key === "limit") {
        this.limit = Number($parts);
        continue;
      }

      if (key === "offset") {
        this.offset = Number($parts);
        continue;
      }

      if (key === "order") {
        for (const $part of $parts.split(",")) {
          const part = /^(.+)(\.asc|\.desc)$/.exec($part);

          if (part) {
            this.order.push({
              key: part[1],
              type: part[2] === ".desc" ? "desc" : "asc"
            });
          }
        }

        continue;
      }

      const [
        _,
        not,
        $eq,
        $gte,
        $in,
        $lte
      ] = /^(not\.)?(?:eq\.(.*)|gte\.(.*)|in\.\((.*)\)|lte\.(.*))/.exec(
        $parts
      ) || ["", "", "", "", "", ""];

      if (!_) {
        continue;
      }

      if ($eq !== undefined) {
        this.filters.push({
          key,
          type: not ? "not.eq" : "eq",
          values: [decodeURIComponent($eq)]
        });
        continue;
      }

      if ($gte !== undefined) {
        this.filters.push({
          key,
          type: not ? "not.gte" : "gte",
          values: [decodeURIComponent($gte)]
        });
        continue;
      }

      if ($in !== undefined) {
        this.filters.push({
          key,
          type: not ? "not.in" : "in",
          values: $in.split(",").map(decodeURIComponent)
        });
        continue;
      }

      if ($lte !== undefined) {
        this.filters.push({
          key,
          type: not ? "not.lte" : "lte",
          values: [decodeURIComponent($lte)]
        });
        continue;
      }
    }

    return this;
  }

  toString() {
    const $ = encodeURIComponent;

    return this.filters
      .map(
        ({ key, type, values }) =>
          `${$(key)}=${$(type)}.${
            type === "in" || type === "not.in"
              ? `(${values
                  .map(x => $(String(x)))
                  .sort()
                  .join(",")})`
              : $(values[0].toString())
          }`
      )
      .concat(this.limit ? `limit=${$(this.limit.toString())}` : [])
      .concat(this.offset ? `offset=${$(this.offset.toString())}` : [])
      .concat(
        this.order.length
          ? `order=${this.order.map(({ key, type }) => `${$(key)}.${type}`)}`
          : []
      )
      .sort()
      .join("&");
  }
}

exports.Query = Query;

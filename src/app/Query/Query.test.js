/* tslint:disable:object-literal-sort-keys */

const { Query } = require("./Query");

class Post {
  constructor() {
    this.boardId = "";
    this.modifiedAt = Date.now();
    this.parentId = "";
  }
}

const { test } = require("gunit");

test("ofs", async t => {
  const now = 1534983769558;

  t.is(
    JSON.stringify(
      Query.of(Post)
        .boardId.not.in(["anime", "tech"])
        .modifiedAt.gte(now - 1000 * 60 * 60 * 24)
        .modifiedAt.lte(now)
        .parentId.eq("")
        .order.modifiedAt.desc()
        .limit(15)
        .offset(30).query
    ),
    JSON.stringify({
      filters: [
        { key: "boardId", type: "not.in", values: ["anime", "tech"] },
        { key: "modifiedAt", type: "gte", values: [1534897369558] },
        { key: "modifiedAt", type: "lte", values: [1534983769558] },
        { key: "parentId", type: "eq", values: [""] }
      ],
      limit: 15,
      offset: 30,
      order: [{ key: "modifiedAt", type: "desc" }]
    })
  );
});

test("parses", async t => {
  t.is(
    JSON.stringify(
      Query.of(Post).parse(
        `boardId=not.in.(anime,tech)&limit=15&modifiedAt=gte.1534639854746&modifiedAt=lte.1534726254746&offset=30&order=modifiedAt.desc&parentId=eq.`
      )
    ),
    JSON.stringify({
      filters: [
        { key: "boardId", type: "not.in", values: ["anime", "tech"] },
        { key: "modifiedAt", type: "gte", values: ["1534639854746"] },
        { key: "modifiedAt", type: "lte", values: ["1534726254746"] },
        { key: "parentId", type: "eq", values: [""] }
      ],
      limit: 15,
      offset: 30,
      order: [{ key: "modifiedAt", type: "desc" }]
    })
  );
});

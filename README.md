# grest.js

REST API framework for GNOME JavaScript. Talks JSON. Wraps [libsoup](https://wiki.gnome.org/Projects/libsoup), a native HTTP client/server library, and [libgda](https://developer.gnome.org/libgda/), a data abstraction layer, with Promise-based plumbing.

## Install

Grest is known to work on Gjs 1.55 with [CommonJS runtime](https://github.com/cgjs/cgjs).

```bash
npm i -S grest
```

## Usage

Routing is resourceful, model-centric. Entity classes are plain JS. Controllers extend `Context` which resembles Koa, and have HTTP verbs (e.g. `GET`) as method names.

```js
const { ServerListenOptions } = imports.gi.Soup;
const { Context, Route } = require("grest");

class Greeting {
  constructor() {
    this.hello = "world";
  }
}

class GreetingController extends Context {
  async get() {
    await Promise.resolve();
    this.body = [new Greeting()];
  }
}

const App = Route.server([
  { path: "/greetings", controller: GreetingController }
]);

App.listen_all(3000, ServerListenOptions.IPV6_ONLY);
App.run();
```

### Receving POST

In constructor, assign a sample body. Usually an array including a model example.

```js
class GreetingController extends Context {
  constructor() {
    super();

    /** @type {Greeting[]} */
    this.body = [new Greeting()];
  }

  async post() {
    const greetings = this.body;

    for (const greeting of greetings) {
      greeting.hello = "earth";
    }

    this.body = greetings;
  }
}
```

## Index

Your app self-documents at `/`, keying example models by corresponding routes. Reads optional metadata from `package.json` in current working directory. Omits repository link if `private` is true.

```json
{
  "app": {
    "description": "Gjs REST API microframework, talks JSON, wraps libsoup",
    "name": "grest",
    "repository": "https://github.com/makepost/grest",
    "version": "1.0.0"
  },
  "examples": {
    "GET /greetings": [
      {
        "hello": "world"
      }
    ]
  }
}
```

## Fetch

Makes a request with optional headers. Returns another Context.

```js
const GLib = imports.gi.GLib;
const { Context } = require("grest");

const base = "https://gitlab.gnome.org/api/v4/projects/GNOME%2Fgjs";

// Returns an array of issues.
const path = "/issues";

const { body } = await Context.fetch(`${base}${path}`, {
  headers: {
    "Private-Token": GLib.getenv("GITLAB_TOKEN")
  }
});

print(body.length);
```

### Sending POST

Grest converts your body to JSON.

```js
const base = "https://httpbin.org";
const path = "/post";

const { body } = await Context.fetch(`${base}${path}`, {
  body: {
    test: Math.floor(Math.random() * 1000)
  },
  method: "POST"
});
```

## Test

Check yourself with [Gunit](https://github.com/makepost/gunit) to get coverage.

```js
// src/app/Greeting/GreetingController.test.js
// Controller and entity are from the examples above.

const { Context, Route } = require("grest");
const { test } = require("gunit");
const { Greeting } = require("../domain/Greeting/Greeting");
const { GreetingController } = require("./GreetingController");

test("gets", async t => {
  const App = Route.server([
    { path: "/greetings", controller: GreetingController }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const { body } = await Context.fetch(`http://localhost:${port}/greetings`);
  t.is(body[0].hello, "world");
});
```

## Database

Assume you have a `Product` table with the following schema:

```sql
create table Product (
  id varchar(64) not null primary key,
  name varchar(64) not null,
  price real
)
```

Define an entity class to match your table:

```js
class Product {
  constructor() {
    this.id = "";
    this.name = "";
    this.price = 0;
  }
}
```

Tell Grest where your db is, and give `Route.server` an extra parameter:

```js
const { Db, Route } = require("grest");
const db = Db.connect("sqlite:example"); // example.db in project root
const services = { db };
const routes = [{ path: "/products", controller: ProductController }];
const App = Route.server(routes, services);
App.listen_all(3000, 0);
App.run();
```

In-memory SQLite and other backends supported by Libgda can work too:

```js
Db.connect("sqlite::memory:");

// Grest parses database config from URL.
Db.connect("mysql://user:pass@host:post/db");

// When deploying, read your database config from an environment variable.
Db.connect(imports.gi.GLib.getenv("DB"));
```

For every request, Grest constructs your controller with your services as props:

```js
class ProductController extends Context {
  /** @param {{ db: Db }} props */
  constructor(props) {
    super(props);
    /** @type {Product[]} */
    this.body = [new Product()];
    this.repo = props.db.repo(Product);
  }

  // ...
}
```

Based on your entity class fields, Grest builds SQL from common queries, executing when you call `await`:

```js
/**
 * @example GET /products?name=not.in.(chair,table)
 * @example GET /products?limit=2&order=price.desc&price=gte.1
 */
async get() {
  this.body = await this.repo.get().parse(this.query);

  // Or build your SELECT query programmatically, with a fluent chain:
  this.body = await this.repo
    .get()
    .name.not.in(["flowers"])
    .order.price.desc()
    .limit(3)
    .offset(1);
}
```

Whitelist or otherwise limit what a user can do:

```js
/** @example DELETE /products?name=eq.chair */
async delete() {
  if (!/^(name|price)=eq\.[a-z0-9-]+$/.test(this.query)) {
    // Beginning digits, if any, define the HTTP response code.
    throw new Error("403 Forbidden Delete Not By Name Or Price");
  }
  await this.repo.delete().parse(this.query);
}
```

Pass a JSON array as body when POSTing:

```js
/** @example POST /products */
async post() {
  await this.repo.post(this.body);

  // Or CREATE manually:
  await this.repo.post([
    { id: "p1", name: "chair", price: 2.0 },
    { id: "p2", name: "table", price: 5 },
    { id: "p3", name: "glass", price: 1.1 },
  ]);

  // Won't do nulls, GDA_TYPE_NULL isn't usable through introspection.
}
```

Wrap your PATCH body in an array as well, to reuse `this.body` type:

```js
/** @example PATCH [{ name: "armchair" }] /products?name=eq.chair */
async patch() {
  await this.repo.patch(this.body[0]).parse(this.query);

  // Doing an UPDATE manually:
  await this.repo
    .patch({ name: "armchair" }) // New values.
    // WHERE conditions:
    .name.eq("chair")
    .price.lte(3);
}
```

[Db test](src/app/Db/Db.test.js) shows how to make lower level SQL queries.

## WebSocket

Grest optionally exposes your API through WebSocket, and lets users subscribe to receive a patch whenever you update the Product repo:

```js
class ProductController extends Context {
  // ...
}

// Whitelist entities that trigger a route refresh.
ProductController.watch = [Product];

exports.ProductController = ProductController;
```

Give `Socket.watch` your routes and services in your entry point:

```js
const services = { db }; // Required.
const App = Route.server(routes, services);
Socket.watch(App, routes, services);
```

Routes exposed to WebSocket can be same as HTTP, or a different set:

```js
const App = Route.server(
  [
    { path: "/greetings", controller: GreetingController },
    { path: "/products", controller: ProductController }
  ],
  services
);

Socket.watch(
  App,
  [{ path: "/products", controller: ProductController }],
  services
);
```

[Socket test](src/app/Socket/Socket.test.js) shows how to set up the client side, and [Patch test](src/app/Patch/Patch.test.js) shows what subscribers recieve.

## License

MIT

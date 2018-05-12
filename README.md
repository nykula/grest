# grest.js

REST API microframework for GNOME JavaScript. Talks JSON. Wraps [libsoup](https://wiki.gnome.org/Projects/libsoup), a native HTTP client/server library, with Promise-based plumbing.

## Install

Grest is known to work on Gjs 1.52 with [CommonJS runtime](https://github.com/cgjs/cgjs).

```bash
yarn add grest
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
  { path: "/greetings", controller: GreetingController, model: Greeting }
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
    { path: "/greetings", controller: GreetingController, model: Greeting }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const { body } = await Context.fetch(`http://localhost:${port}/greetings`);
  t.is(body[0].hello, "world");
});
```

## License

MIT

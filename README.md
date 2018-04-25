# grest.js

REST API microframework for GNOME JavaScript. Talks JSON. Wraps [libsoup](https://wiki.gnome.org/Projects/libsoup), a native HTTP client/server library, with Promise-based plumbing.

## Install

Grest is known to work on Gjs 1.50.2 with [CommonJS runtime](https://github.com/cgjs/cgjs).

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

## License

MIT

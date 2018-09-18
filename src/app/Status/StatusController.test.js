const { test } = require("gunit");
const { Status } = require("../../domain/Status/Status");
const { Context } = require("../Context/Context");
const { Route } = require("../Route/Route");
const { StatusController } = require("./StatusController");

test("gets", async t => {
  const App = Route.server([
    { path: "/statuses", controller: StatusController }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const { body } = await Context.fetch(`http://localhost:${port}/statuses`);
  t.is(!!body[0].mrs, true);
});

test("posts", async t => {
  const App = Route.server([
    { path: "/statuses", controller: StatusController }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const status = new Status();
  status.mrs = 0;

  const status1 = new Status();
  status1.mrs = 0;

  const { body } = await Context.fetch(`http://localhost:${port}/statuses`, {
    body: [status, status1],
    method: "POST"
  });

  t.is(!!body[0].mrs, true);
  t.is(!!body[1].mrs, true);
});

test("documents", async t => {
  const App = Route.server([
    { path: "/statuses", controller: StatusController }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const { body } = await Context.fetch(`http://localhost:${port}/`);
  const key = String(
    Object.keys(body.examples).find(x => x.endsWith("/statuses"))
  );

  t.is(typeof body.examples[key][0].mrs, "number");
});

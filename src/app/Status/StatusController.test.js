const { test } = require("gunit");
const { Status } = require("../../domain/Status/Status");
const { Context } = require("../Context/Context");
const { Route } = require("../Route/Route");
const { StatusController } = require("./StatusController");

test("gets", async t => {
  const App = Route.server([
    { path: "/statuses", controller: StatusController, model: Status }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const { body } = await Context.fetch(`http://localhost:${port}/statuses`);
  t.is(!!body[0].mrs, true);
});

test("documents", async t => {
  const App = Route.server([
    { path: "/statuses", controller: StatusController, model: Status }
  ]);

  const port = 8000 + Math.floor(Math.random() * 10000);
  App.listen_all(port, 0);

  const { body } = await Context.fetch(`http://localhost:${port}/`);
  const key = String(
    Object.keys(body.examples).find(x => x.endsWith("/statuses"))
  );

  t.is(typeof body.examples[key][0].mrs, "number");
});

const { Db } = require("./Db/Db");
const { ProductController } = require("./Product/ProductController");
const { Route } = require("./Route/Route");
const { Socket } = require("./Socket/Socket");
const { StatusController } = require("./Status/StatusController");

const routes = [
  { controller: ProductController, path: "/products" },
  { controller: StatusController, path: "/statuses" }
];

const services = { db: Db.connect("sqlite:example_db") };

const App = Route.server(routes, services);
Socket.watch(App, routes, services);

exports.App = App;

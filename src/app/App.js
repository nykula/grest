const { Status } = require("../domain/Status/Status");
const { Route } = require("./Route/Route");
const { StatusController } = require("./Status/StatusController");

const App = Route.server([
  { path: "/statuses", controller: StatusController, model: Status }
]);

exports.App = App;

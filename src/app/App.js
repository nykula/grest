const { Route } = require("./Route/Route");
const { StatusController } = require("./Status/StatusController");

const App = Route.server([{ path: "/statuses", controller: StatusController }]);

exports.App = App;

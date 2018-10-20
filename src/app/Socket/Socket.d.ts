import { Context } from "../Context/Context";
import { Db } from "../Db/Db";
import { Route } from "../Route/Route";

export class Socket {
  static ok(request: Context): Context
  static watch(App: any, routes: Route[], services: { db: Db; }): void
}

import { Context } from "../Context/Context";

export class Route {
  static pkg: any
  static error(error: { message?: string; }): { message: string; status: number; }
  static runIfAllows(controller: Context): Promise<void>
  static server(routes: Route[], services?: {}): any
  controller: typeof Context
  path: string
}

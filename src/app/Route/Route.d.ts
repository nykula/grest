import { Context } from "../Context/Context";

export class Route {
  static pkg: any
  static error(error: { message?: string; }): { message: string; status: number; }
  static exec(controller: Context): Promise<void>
  static handleRequest(request: Context, ctx: Context): Promise<Context>
  static server(routes: Route[], services?: {}): any
  controller: typeof Context
  path: string
}

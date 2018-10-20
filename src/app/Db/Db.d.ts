import { IRepo } from "../Repo/Repo";

export class Db {
  static connect(uri: string): Db
  GLib: any
  callbacks: (() => void)[]
  connection: any
  parser: any
  pollInterval: number
  repos: any
  constructor(connection: any)
  execute(statement: any, parameters: any): Promise<[any, any]>
  prepare(sql: string): [any, any]
  repo<T>(model: new () => T): IRepo<T>
}

import { IQuery, Query } from "../Query/Query";

export class Repo<T> {
  static of<T>(db: any, model: new () => T): IRepo<T>
  callbacks: any[];
  constructor(db: any, model: new () => T);
  delete(props: { query: Query }): Promise<void>;
  get(props: { query: Query }): Promise<T[]>;
  patch(diff: Partial<T>, props: { query: Query }): Promise<void>;
  post(entities: T[]): Promise<void>;
}

export type IRepo<T>={
  delete(): IQuery<T, Promise<void>>;
  get(): IQuery<T, Promise<T[]>>;
  on(_: "*", callback: () => void): void;
  patch(diff: Partial<T>): IQuery<T, Promise<void>>;
  post(entities: T[]): Promise<void>;
}

interface IDb {
  execute(stmt: any, params: any): Promise<[any, any]>,
  prepare: (sql: string) => [any, any]
}

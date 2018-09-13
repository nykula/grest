import { IQuery, Query } from "../Query/Query";

export class Repo<T> {
  static of<T>(db: any, model: new () => T): {
    delete(): IQuery<T> & Promise<void>;

    get(): IQuery<T> & Promise<T[]>;

    patch(diff: Partial<T>): IQuery<T> & Promise<void>;

    post(entities: T[]): Promise<void>;
  }

  constructor(db: any, model: new () => T);

  delete(props: { query: Query }): Promise<void>;

  get(props: { query: Query }): Promise<T[]>;

  patch(diff: Partial<T>, props: { query: Query }): Promise<void>;

  post(entities: T[]): Promise<void>;
}
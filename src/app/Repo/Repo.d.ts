import { Query } from "../Query/Query";

export class Repo<T> {
  constructor(db: any, model: new () => T);

  delete(props: { query: Query }): Promise<void>;

  get(props: { query: Query }): Promise<T[]>;

  patch(diff: Partial<T>, props: { query: Query }): Promise<void>;

  post(entities: T[]): Promise<void>;
}
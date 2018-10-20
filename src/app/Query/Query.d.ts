export class Query {
  static of<T>(model: new () => T): IQuery<T, {}>;
  filters: { key: string, type: "eq" | "not.eq" | "gte" | "not.gte" | "in" | "not.in" | "lte" | "not.lte", values: Value[] }[]
  limit: number
  offset: number
  order: { key: string, type: "asc" | "desc" }[]
}

export type IQuery<T, Y> = {
  [P in keyof T]: T[P] extends Value ? {
    not: {
      eq(value: T[P]): IQuery<T, Y>
      gte(value: T[P]): IQuery<T, Y>
      in(values: T[P][]): IQuery<T, Y>
      lte(value: T[P]): IQuery<T, Y>
    }
    eq(value: T[P]): IQuery<T, Y>
    gte(value: T[P]): IQuery<T, Y>
    in(values: T[P][]): IQuery<T, Y>
    lte(value: T[P]): IQuery<T, Y>
  } : never;
} & {
  order: {
    [P in keyof T]: T[P] extends Value ? {
      asc(): IQuery<T, Y>
      desc(): IQuery<T, Y>
    } : never
  }
  query: Query
  limit(value: number): IQuery<T, Y>
  offset(value: number): IQuery<T, Y>
  parse($query: string): IQuery<T, Y>
} & Y

type Value = boolean | number | string
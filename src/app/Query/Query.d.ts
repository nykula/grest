export class Query {
  static of<T>(model: new () => T): IQuery<T>;

  filters: { key: string, type: "eq" | "not.eq" | "gte" | "not.gte" | "in" | "not.in" | "lte" | "not.lte", values: Value[] }[]

  limit: number

  offset: number

  order: { key: string, type: "asc" | "desc" }[]
}

type IQuery<T> = {
  [P in keyof T]: T[P] extends Value ? {
    not: {
      eq(value: T[P]): IQuery<T>

      gte(value: T[P]): IQuery<T>

      in(values: T[P][]): IQuery<T>

      lte(value: T[P]): IQuery<T>
    }

    eq(value: T[P]): IQuery<T>

    gte(value: T[P]): IQuery<T>

    in(values: T[P][]): IQuery<T>

    lte(value: T[P]): IQuery<T>
  } : never;
} & {
  order: {
    [P in keyof T]: T[P] extends Value ? {
      asc(): IQuery<T>

      desc(): IQuery<T>
    } : never
  }

  query: Query

  limit(value: number): IQuery<T>

  offset(value: number): IQuery<T>

  parse($query: string): IQuery<T>
}

type Value = boolean | number | string
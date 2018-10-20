export class Context {
  static watch: (new () => any)[]
  static fetch(url: string, ctx?: Partial<Context>): Promise<Context>
  body: any
  headers: { [key: string]: string; }
  id: string
  ip: string
  method: string
  path: string
  props: any
  query: string
  status: number
  constructor(props?: any)
}

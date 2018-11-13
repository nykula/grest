export class Context {
  static watch: (new () => any)[]
  static fetch(url: string, ctx?: Partial<Context>): Promise<Context>
  body: any
  headers: { [key: string]: string; }
  id: string
  ip: string
  length: number
  method: string
  path: string
  props: any
  protocol: string
  query: string
  status: number
  userId: string
  constructor(props?: any)
}

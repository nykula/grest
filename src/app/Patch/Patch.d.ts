export class Patch {
  static apply(x: string, _: (string | number)[]): string
  static diff(x: string, y: string): (string | number)[]
}

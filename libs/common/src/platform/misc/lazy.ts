const NoValue = Symbol("NoValue");

export class Lazy<T> {
  private _value: T | typeof NoValue = NoValue;

  constructor(private readonly factory: () => T) {}

  /**
   * Resolves the factory and returns the result. Guaranteed to resolve the value only once.
   *
   * @returns The value produced by your factory.
   */
  get(): T {
    if (this._value === NoValue) {
      return (this._value = this.factory());
    }

    return this._value;
  }
}

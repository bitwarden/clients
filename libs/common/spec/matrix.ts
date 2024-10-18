type PickFirst<Array> = Array extends [infer First, ...unknown[]] ? First : never;

type MatrixOrValue<Array extends unknown[], Value> = Array extends []
  ? Value
  : Matrix<Array, Value>;

type RemoveFirst<T> = T extends [unknown, ...infer Rest] ? Rest : never;

/**
 * A matrix is intended to manage cached values for a set of method arguments.
 */
export class Matrix<TKeys extends unknown[], TValue> {
  private map: Map<PickFirst<TKeys>, MatrixOrValue<RemoveFirst<TKeys>, TValue>> = new Map();

  /**
   *
   * @param mockFunction
   * @param creator
   * @returns
   */
  static autoMockMethod<TReturn, TArgs extends unknown[], TActualReturn extends TReturn>(
    mockFunction: jest.Mock<TReturn, TArgs>,
    creator: (args: TArgs) => TActualReturn,
  ): (...args: TArgs) => TActualReturn {
    const matrix = new Matrix<TArgs, TActualReturn>();

    const getter = (...args: TArgs) => {
      return matrix.getOrCreateEntry(args, creator);
    };

    mockFunction.mockImplementation(getter);

    return getter;
  }

  getOrCreateEntry(args: TKeys, creator: (args: TKeys) => TValue): TValue {
    if (args.length === 0) {
      throw new Error("Matrix is not for you.");
    }

    if (args.length === 1) {
      const arg = args[0] as PickFirst<TKeys>;
      if (this.map.has(arg)) {
        // Get the cached value
        return this.map.get(arg) as TValue;
      } else {
        const value = creator(args);
        // Save the value for the next time
        this.map.set(arg, value as MatrixOrValue<RemoveFirst<TKeys>, TValue>);
        return value;
      }
    }

    // There are for sure 2 or more args
    const [first, ...rest] = args as unknown as [PickFirst<TKeys>, ...RemoveFirst<TKeys>];

    let matrix: Matrix<RemoveFirst<TKeys>, TValue> | null = null;

    if (this.map.has(first)) {
      // We've already created a map for this argument
      matrix = this.map.get(first) as Matrix<RemoveFirst<TKeys>, TValue>;
    } else {
      matrix = new Matrix<RemoveFirst<TKeys>, TValue>();
      this.map.set(first, matrix as MatrixOrValue<RemoveFirst<TKeys>, TValue>);
    }

    return matrix.getOrCreateEntry(rest, () => creator(args));
  }
}

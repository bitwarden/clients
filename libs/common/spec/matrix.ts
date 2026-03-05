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
   * This is especially useful for methods on a service that take inputs but return Observables.
   * Generally when interacting with observables in tests, you want to use a simple SubjectLike
   * type to back it instead, so that you can easily `next` values to simulate an emission.
   *
   * @param mockFunction The function to have a Matrix based implementation added to it.
   * @param creator The function to use to create the underlying value to return for the given arguments.
   * @returns A "getter" function that allows you to retrieve the backing value that is used for the given arguments.
   *
   * @example
   * ```ts
   * interface MyService {
   *   event$(userId: UserId) => Observable<UserEvent>
   * }
   *
   * // Test
   * const myService = mock<MyService>();
   * const eventGetter = Matrix.autoMockMethod(myService.event$, (userId) => BehaviorSubject<UserEvent>());
   *
   * eventGetter("userOne").next(new UserEvent());
   * eventGetter("userTwo").next(new UserEvent());
   * ```
   *
   * This replaces a more manual way of doing things like:
   *
   * ```ts
   * const myService = mock<MyService>();
   * const userOneSubject = new BehaviorSubject<UserEvent>();
   * const userTwoSubject = new BehaviorSubject<UserEvent>();
   * myService.event$.mockImplementation((userId) => {
   *    if (userId === "userOne") {
   *      return userOneSubject;
   *    } else if (userId === "userTwo") {
   *      return userTwoSubject;
   *    }
   *    return new BehaviorSubject<UserEvent>();
   * });
   *
   * userOneSubject.next(new UserEvent());
   * userTwoSubject.next(new UserEvent());
   * ```
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

  /**
   * Gives the ability to get or create an entry in the matrix via the given args.
   *
   * @note The args are evaulated using Javascript equality so primivites work best.
   *
   * @param args The arguments to use to evaluate if an entry in the matrix exists already,
   *   or a value should be created and stored with those arguments.
   * @param creator The function to call with the arguments to build a value.
   * @returns The existing entry if one already exists or a new value created with the creator param.
   */
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

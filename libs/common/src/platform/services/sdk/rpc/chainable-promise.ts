type AsChainable<T> = T extends object
  ? T extends Promise<T>
    ? T & { await: AwaitProxy<T> }
    : Promise<T> & { await: AwaitProxy<T> }
  : Promise<T>;

type AwaitProxy<T> = {
  // Methods that return Promise<R> -> (...args) => Promise<R> (and if R is object, re-wrap to Chainable)
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => AsChainable<R>
    : // Sync methods -> (...args) => Promise<R> (and re-wrap objects)
      T[K] extends (...args: infer A) => infer R
      ? (...args: A) => AsChainable<R>
      : // Properties -> Promise<T[K]>
        Promise<T[K]>;
};

export type ChainablePromise<T> = T extends object
  ? T extends Promise<T>
    ? T & { await: AwaitProxy<T> }
    : Promise<T> & { await: AwaitProxy<T> }
  : Promise<T>;

export function chain<T extends object>(p: Promise<T>): ChainablePromise<T> {
  const promise: any = p;

  if (!promise.await) {
    const wrapIfObject = <U>(x: U): any =>
      typeof x === "object" && x !== null ? chain(Promise.resolve(x as any)) : x;

    promise.await = new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          return (...args: any[]) =>
            Promise.resolve(p).then(async (obj) => {
              // Special-case: allow uniform `.await.by_value()` usage on both references and plain values.
              if (prop === "by_value") {
                // If the object has a callable by_value, call it; otherwise return the object as-is.
                const maybe = (obj as any)[prop];
                if (typeof maybe === "function") {
                  const result = await maybe.apply(obj, args);
                  return wrapIfObject(result);
                }
                return obj;
              }

              const member = (obj as any)[prop];
              if (typeof member === "function") {
                const result = await member.apply(obj, args);
                return wrapIfObject(result);
              }
              // property access
              return wrapIfObject(member);
            });
        },
      },
    );
  }

  return promise;
}

class A {
  method(): ChainablePromise<B> {
    return chain(B.createB());
  }
}

class B {
  static async createB(): Promise<B> {
    return new B();
  }

  async asyncMethod(): Promise<B> {
    return new B();
  }

  syncMethod(): number {
    return 42;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testChainable() {
  const objectA = new A();
  return objectA.method().await.asyncMethod().await.syncMethod();
}

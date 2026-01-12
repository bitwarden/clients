export type Disposable = { [Symbol.dispose]: () => void };

/**
 * Types implementing this type must be used together with the `using` keyword
 *
 * @example using ref = rc.take();
 */
// We want to use `interface` here because it creates a separate type.
// Type aliasing would not expose `UsingRequired` to the linter.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UsingRequired extends Disposable {}

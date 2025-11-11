import { ChainablePromise } from "./chainable-promise";

export type Remote<T> = {
  [K in keyof T as K extends typeof Symbol.dispose ? never : K]: RemoteProperty<T[K]>;
} & (typeof Symbol.dispose extends keyof T ? { [Symbol.asyncDispose](): Promise<void> } : object);

type Resolved<T> = T extends Promise<infer U> ? U : T;

/**
 * Maps remote object fields to RPC-exposed types.
 */
export type RemoteProperty<T> = T extends (...args: any[]) => any
  ? RemoteFunction<T>
  : RemoteReference<Resolved<T>>;

export type Transfer<T> = {
  /**
   * Force a by-value snapshot transfer of this remote reference. Resolves to a serializable value.
   * If the object is not serializable at runtime, this will throw.
   */
  transfer: Resolved<T>;
};

export type RemoteReference<T> = Remote<T> & Transfer<T>;

/**
 * RemoteFunction arguments must be Serializable at compile time. For non-serializable
 * return types, we expose ChainablePromise<Remote<...>> to enable Rust-like `.await` chaining.
 */
export type RemoteFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => ChainablePromise<RemoteReference<Resolved<ReturnType<T>>>> & Transfer<Resolved<ReturnType<T>>>;

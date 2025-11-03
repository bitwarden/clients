import { ChainablePromise } from "./chainable-promise";

export type Remote<T> = {
  [K in keyof T as K extends typeof Symbol.dispose ? never : K]: RemoteProperty<T[K]>;
} & (typeof Symbol.dispose extends keyof T ? { [Symbol.asyncDispose](): Promise<void> } : object);

type Resolved<T> = T extends Promise<infer U> ? U : T;
// type HasFree<T> = T extends { free(): void } ? true : false;

/**
 * Maps remote object fields to RPC-exposed types.
 *
 * Property access (non-function):
 * - If the value is serializable (see IsSerializable), returns Promise<Resolved<T>>.
 * - If not serializable (e.g., class instance, Wasm object), returns Remote<Resolved<T>> (a live reference).
 *   Note: properties do NOT expose `.await`; they are direct remote references.
 *
 * Function call:
 * - If the return value is serializable, returns Promise<Resolved<R>>.
 * - If not serializable, returns ChainablePromise<Remote<Resolved<R>>> so callers can use `.await`
 *   for ergonomic chaining, e.g. remote.vault().await.totp().await.generate(...).
 */
export type RemoteProperty<T> = T extends (...args: any[]) => any
  ? RemoteFunction<T>
  : RemoteReference<Resolved<T>>;
// : HasFree<Resolved<T>> extends true
//   ? RemoteReference<Resolved<T>>
//   : Promise<Resolved<T>>;

export type Transfer<T> = {
  /**
   * Force a by-value snapshot transfer of this remote reference. Resolves to a serializable value.
   * If the object is not serializable at runtime, this will throw.
   */
  transfer: Promise<T>;
};

export type RemoteReference<T> = Remote<T> &
  Transfer<T> & {
    /**
     * Force a by-value snapshot transfer of this remote reference. Resolves to a serializable value.
     * If the object is not serializable at runtime, this will throw.
     *
     * OLD: Remove
     */
    by_value(): Promise<T>;
  };

/**
 * RemoteFunction arguments must be Serializable at compile time. For non-serializable
 * return types, we expose ChainablePromise<Remote<...>> to enable Rust-like `.await` chaining.
 */
export type RemoteFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => ChainablePromise<RemoteReference<Resolved<ReturnType<T>>>> & Transfer<Resolved<ReturnType<T>>>;
// ) => Resolved<ReturnType<T>> extends object
//   ? ChainablePromise<RemoteReference<Resolved<ReturnType<T>>>>
//   : Promise<Resolved<ReturnType<T>>>;

// Serializable type rules to mirror `isSerializable` from rpc/server.ts
// - Primitives: string | number | boolean | null
// - Arrays: elements must be Serializable
// - Plain objects: all non-function properties must be Serializable
// - Everything else (functions, class instances, Date, Map, Set, etc.) is NOT serializable
// Serializability checks removed: transport and server decide value vs reference.

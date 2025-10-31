import { ChainablePromise } from "./chainable-promise";

export type Remote<T> = {
  [K in keyof T]: RemoteProperty<T[K]>;
};

type Resolved<T> = T extends Promise<infer U> ? U : T;

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
  : IsSerializable<Resolved<T>> extends true
    ? Promise<Resolved<T>>
    : Remote<Resolved<T>>;

export type RemoteReference<T> = Remote<T>;

/**
 * RemoteFunction arguments must be Serializable at compile time. For non-serializable
 * return types, we expose ChainablePromise<Remote<...>> to enable Rust-like `.await` chaining.
 */
export type RemoteFunction<T extends (...args: any[]) => any> = <A extends Parameters<T>>(
  // Enforce serializability of RPC arguments here.
  // If we wanted to we could allow for remote references as arguments, we could do that here.
  // In that case the client would also need to maintain a ReferenceStore for outgoing references.
  ...args: SerializableArgs<A>
) => IsSerializable<Resolved<ReturnType<T>>> extends true
  ? Promise<Resolved<ReturnType<T>>>
  : ChainablePromise<Remote<Resolved<ReturnType<T>>>>;

// Serializable type rules to mirror `isSerializable` from rpc/server.ts
// - Primitives: string | number | boolean | null
// - Arrays: elements must be Serializable
// - Plain objects: all non-function properties must be Serializable
// - Everything else (functions, class instances, Date, Map, Set, etc.) is NOT serializable
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

type IsFunction<T> = T extends (...args: any[]) => any ? true : false;
type IsArray<T> = T extends readonly any[] ? true : false;

type IsSerializablePrimitive<T> = [T] extends [string | number | boolean | null] ? true : false;

type IsSerializableArray<T> = T extends readonly (infer U)[] ? IsSerializable<U> : false;

type PropsAreSerializable<T> =
  Exclude<
    {
      [K in keyof T]-?: IsFunction<T[K]> extends true ? false : IsSerializable<T[K]>;
    }[keyof T],
    true
  > extends never
    ? true
    : false;

type IsSpecialObject<T> = T extends
  | Date
  | RegExp
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  ? true
  : false;

type IsSerializableObject<T> =
  IsFunction<T> extends true
    ? false
    : IsArray<T> extends true
      ? false
      : IsSpecialObject<T> extends true
        ? false
        : T extends object
          ? PropsAreSerializable<T>
          : false;

export type IsSerializable<T> =
  IsAny<T> extends true
    ? false // discourage any; use explicit types
    : IsNever<T> extends true
      ? true
      : IsSerializablePrimitive<T> extends true
        ? true
        : IsArray<T> extends true
          ? IsSerializableArray<T>
          : IsSerializableObject<T>;

// Public helper alias for consumers
export type Serializable<T> = IsSerializable<T> extends true ? T : never;

// Human-readable reason per kind
type NonSerializableReason<T> =
  IsFunction<T> extends true
    ? "functions are not serializable"
    : IsArray<T> extends true
      ? "array contains non-serializable element(s)"
      : IsSpecialObject<T> extends true
        ? "class instances / special objects (Date/Map/Set/RegExp/...) are not serializable"
        : T extends object
          ? "object contains non-serializable property"
          : "type is not serializable";

// Tuple-literal error type so TS prints a helpful message at the callsite
type EnsureSerializableWithMessage<T, C extends string> =
  IsSerializable<T> extends true
    ? T
    : ["Non-serializable RPC argument", C, NonSerializableReason<T>];

type IndexLabel<K> = K extends string | number ? `${K}` : "?";
type SerializableArgs<A extends any[]> = {
  [K in keyof A]: EnsureSerializableWithMessage<A[K], `arg[${IndexLabel<K>}]`>;
};

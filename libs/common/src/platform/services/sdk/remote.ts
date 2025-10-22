import { ChainablePromise } from "./chainable-promise";

export type Remote<T> = {
  [K in keyof T]: RemoteProperty<T[K]>;
};

export type RemoteProperty<T> = T extends (...args: any[]) => any
  ? RemoteFunction<T>
  : RemoteValue<T>;

export type RemoteReference<T> = Remote<T>;

export type RemoteValue<T> = T extends { free(): void }
  ? ChainablePromise<RemoteReference<T>>
  : T extends Promise<infer R>
    ? Promise<R>
    : Promise<T>;

export type RemoteFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => RemoteValue<ReturnType<T>>;

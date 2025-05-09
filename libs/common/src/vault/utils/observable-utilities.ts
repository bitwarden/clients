import { EMPTY, filter, map, merge, Observable, OperatorFunction, shareReplay } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

/**
 * Builds an observable once per userId and caches it for future requests.
 * The built observables are shared among subscribers with a replay buffer size of 1.
 *
 * Optionally, a clearBuffer$ observable can be provided to clear the replay buffer for a specific or all userIds.
 * @param create - A function that creates an observable for a given userId.
 * @param clearBuffer$ - An observable that, when emitted, clears the buffer for the emitted userId. When null is emitted, all caches are cleared.
 */
export function perUserCache$<TValue>(
  create: (userId: UserId) => Observable<TValue>,
  clearBuffer$: Observable<UserId | null>,
): (userId: UserId) => Observable<TValue | null>;
export function perUserCache$<TValue>(
  create: (userId: UserId) => Observable<TValue>,
): (userId: UserId) => Observable<TValue>;
export function perUserCache$<TValue>(
  create: (userId: UserId) => Observable<TValue>,
  clearBuffer$: Observable<UserId | null> | undefined = undefined,
): (userId: UserId) => Observable<TValue | null> {
  const cache = new Map<UserId, Observable<TValue | null>>();
  return (userId: UserId) => {
    let observable = cache.get(userId);
    if (!observable) {
      clearBuffer$ ??= EMPTY;
      observable = merge(
        create(userId),
        clearBuffer$.pipe(
          filter((clearId) => clearId === userId || clearId === null),
          map(() => null),
        ),
      ).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      cache.set(userId, observable);
    }
    return observable;
  };
}

/**
 * Strongly typed observable operator that filters out null/undefined values and adjusts the return type to
 * be non-nullable.
 *
 * @example
 * ```ts
 * const source$ = of(1, null, 2, undefined, 3);
 * source$.pipe(filterOutNullish()).subscribe(console.log);
 * // Output: 1, 2, 3
 * ```
 */
export function filterOutNullish<T>(): OperatorFunction<T | undefined | null, T> {
  return filter((v): v is T => v != null);
}

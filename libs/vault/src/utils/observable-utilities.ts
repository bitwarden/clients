import { Observable, shareReplay } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

/**
 * Builds an observable once per userId and caches it for future requests.
 * The built observables are shared among subscribers with a replay buffer size of 1.
 * @param create - A function that creates an observable for a given userId.
 */
export function perUserCache$<TValue>(
  create: (userId: UserId) => Observable<TValue>,
): (userId: UserId) => Observable<TValue> {
  const cache = new Map<UserId, Observable<TValue>>();
  return (userId: UserId) => {
    let observable = cache.get(userId);
    if (!observable) {
      observable = create(userId).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      cache.set(userId, observable);
    }
    return observable;
  };
}

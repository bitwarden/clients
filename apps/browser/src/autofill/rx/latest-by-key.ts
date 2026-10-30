import { defer, EMPTY, map, merge, Observable, OperatorFunction, startWith } from "rxjs";

/**
 * Folds `[key, value]` pairs into the latest value for each key, for joining at an event's arrival.
 * The map is emitted empty first so that `withLatestFrom` has a value from the moment it subscribes;
 * a key that has not emitted yet is absent from it.
 *
 * Every emission is the same map, updated in place — an accumulator read at join time, never diffed
 * across emissions. Each subscription owns its own map.
 *
 * @param removed$ - emits each key to remove from the map. Without it an entry lives as long as the
 *   subscription.
 */
export function latestByKey<K, V>(
  removed$: Observable<K> = EMPTY,
): OperatorFunction<readonly [key: K, value: V], ReadonlyMap<K, V>> {
  return (pairs$) =>
    defer(() => {
      const latest = new Map<K, V>();
      return merge(
        pairs$.pipe(map(([key, value]) => latest.set(key, value))),
        removed$.pipe(
          map((key) => {
            latest.delete(key);
            return latest;
          }),
        ),
      ).pipe(startWith(latest));
    });
}

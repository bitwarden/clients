import {
  merge,
  MonoTypeOperatorFunction,
  Observable,
  ObservableInput,
  sample,
  share,
  skipUntil,
  take,
} from "rxjs";

/**
 * Operator that waits until the trigger observable emits before allowing the source to continue emission.
 * @param trigger$ The observable that will trigger the source to continue emission.
 *
 * ```
 * source$  a-----b-----c-----d-----e
 * trigger$ ---------------X---------
 * output$  ---------------c--d-----e
 * ```
 */
export const waitUntil = <T>(trigger$: ObservableInput<any>): MonoTypeOperatorFunction<T> => {
  return (source: Observable<T>) => {
    const sharedSource$ = source.pipe(share());
    return merge(
      sharedSource$.pipe(sample(trigger$), take(1)),
      sharedSource$.pipe(skipUntil(trigger$)),
    );
  };
};

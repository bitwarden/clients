import { defer, finalize, from, Observable, ObservableInput } from "rxjs";

/**
 * Makes a disposable resource part of a stream's lifetime. Each subscription creates its own
 * resource and hands it to `use`, which builds the stream that runs on it. The resource is disposed
 * when that stream completes, errors, or is unsubscribed from.
 *
 * Like rxjs's `using`, but for a resource disposed with `Symbol.dispose`, and one that cannot
 * outlive the stream that created it. A resource whose `use` throws is disposed before the error
 * is rethrown.
 *
 * @param create - creates the resource when the stream is subscribed.
 * @param use - builds the stream from the resource.
 */
export function usingDisposable<T extends Disposable, R>(
  create: () => T,
  use: (resource: T) => ObservableInput<R>,
): Observable<R> {
  return defer(() => {
    const resource = create();
    try {
      return from(use(resource)).pipe(finalize(() => resource[Symbol.dispose]()));
    } catch (error: unknown) {
      resource[Symbol.dispose]();
      throw error;
    }
  });
}

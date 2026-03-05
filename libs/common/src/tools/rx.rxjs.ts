import { Observable } from "rxjs";

/**
 * Used to infer types from arguments to functions like {@link withLatestReady}.
 * So that you can have `forkJoin([Observable<A>, PromiseLike<B>]): Observable<[A, B]>`
 * et al.
 * @remarks this type definition is derived from rxjs' {@link ObservableInputTuple}.
 *   The difference is it *only* works with observables, while the rx version works
 *   with any thing that can become an observable.
 */
export type ObservableTuple<T> = {
  [K in keyof T]: Observable<T[K]>;
};

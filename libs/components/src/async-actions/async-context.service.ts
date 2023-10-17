import { Injectable, Optional, SkipSelf } from "@angular/core";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  first,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { FunctionReturningAwaitable, functionToObservable } from "../utils/function-to-observable";

import { BitAsyncEvent } from "./bit-async-event";
import { BitAsyncTag } from "./bit-async-tag";

export type BitAsyncAction = { handler: FunctionReturningAwaitable; event: BitAsyncEvent };
export type BitAsyncCompletedAction = {
  tag?: BitAsyncTag;
  definedIn?: AsyncContextService;
  executedIn: AsyncContextService;
};

@Injectable()
export class AsyncContextService {
  private destroy$ = new Subject<void>();

  private _requestedAction$ = new Subject<BitAsyncAction>();
  private _selfCurrentAction$ = new BehaviorSubject<BitAsyncAction | undefined>(undefined);
  private _selfCompletedAction$ = new Subject<BitAsyncCompletedAction>();
  private _selfLoading$ = new BehaviorSubject<boolean>(false);
  private _selfDisabled$ = new BehaviorSubject<boolean>(false);

  readonly currentAction$: Observable<BitAsyncAction | undefined>;
  readonly completedAction$: Observable<BitAsyncCompletedAction>;
  readonly disabled$: Observable<boolean>;
  readonly loading$: Observable<boolean>;

  constructor(
    @Optional() @SkipSelf() parentContext?: AsyncContextService,
    @Optional() validationService?: ValidationService,
    @Optional() logService?: LogService
  ) {
    if (parentContext) {
      this.currentAction$ = combineLatest({
        parentCurrentAction: parentContext.currentAction$,
        selfCurrentAction: this._selfCurrentAction$,
      }).pipe(
        map(
          ({ parentCurrentAction, selfCurrentAction }) => parentCurrentAction || selfCurrentAction
        )
      );

      this.completedAction$ = merge(this._selfCompletedAction$, parentContext.completedAction$);

      this.disabled$ = combineLatest({
        parentDisabled: parentContext.disabled$,
        selfDisabled: this._selfDisabled$,
      }).pipe(map(({ parentDisabled, selfDisabled }) => parentDisabled || selfDisabled));

      this.loading$ = combineLatest({
        parentLoading: parentContext.loading$,
        selfLoading: this._selfLoading$,
      }).pipe(map(({ parentLoading, selfLoading }) => parentLoading || selfLoading));
    } else {
      this.currentAction$ = this._selfCurrentAction$.asObservable();
      this.completedAction$ = this._selfCompletedAction$.asObservable();
      this.disabled$ = this._selfDisabled$.asObservable();
      this.loading$ = this._selfLoading$.asObservable();
    }

    this._requestedAction$
      .pipe(
        switchMap((action) =>
          combineLatest({
            action: of(action),
            disabled: this.disabled$.pipe(first()),
            loading: this.loading$.pipe(first()),
          })
        ),
        filter(({ disabled, loading }) => !disabled && !loading),
        switchMap(({ action }) => {
          this._selfLoading$.next(true);
          this._selfCurrentAction$.next(action);

          const awaitable = functionToObservable(action.handler);
          return awaitable.pipe(
            catchError((err: unknown) => {
              logService?.error(`Async action exception: ${err}`);
              validationService?.showError(err);
              return of(undefined);
            }),
            map((_) => {
              return {
                tag: action.event.tag,
                definedIn: action.event.originalContext,
                executedIn: this,
              } as BitAsyncCompletedAction;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (completedAction) => {
          this._selfCompletedAction$.next(completedAction);
          this._selfLoading$.next(false);
          this._selfCurrentAction$.next(undefined);
        },
        // `complete` represents the service being destroyed
        complete: () => {
          // missing `selfCompletedAction.next` because if there was an action in progress, then it will never complete
          this._selfLoading$.next(false);
          this._selfCurrentAction$.next(undefined);
        },
      });
  }

  private get disabled() {
    return this._selfDisabled$.value;
  }

  private set disabled(value: boolean) {
    this._selfDisabled$.next(value);
  }

  get loading() {
    return this._selfLoading$.value;
  }

  set loading(value: boolean) {
    this._selfLoading$.next(value);
  }

  execute(event: BitAsyncEvent, handler: FunctionReturningAwaitable): void;
  execute(handler: FunctionReturningAwaitable): void;
  execute(
    eventOrHandler: BitAsyncEvent | FunctionReturningAwaitable,
    handler?: FunctionReturningAwaitable
  ): void {
    if (typeof eventOrHandler === "function") {
      this._requestedAction$.next({ handler: eventOrHandler, event: new BitAsyncEvent(this) });
      return;
    }

    this._requestedAction$.next({ handler, event: eventOrHandler });
  }
}

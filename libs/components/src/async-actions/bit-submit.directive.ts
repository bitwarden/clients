// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnDestroy, OnInit, Optional, input } from "@angular/core";
import { FormGroupDirective } from "@angular/forms";
import { BehaviorSubject, catchError, filter, of, Subject, switchMap, takeUntil } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { FunctionReturningAwaitable, functionToObservable } from "../utils/function-to-observable";

/**
 * Allow a form to perform async actions on submit, disabling the form while the action is processing.
 */
@Directive({
  selector: "[formGroup][bitSubmit]",
})
export class BitSubmitDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private _loading$ = new BehaviorSubject<boolean>(false);
  private _disabled$ = new BehaviorSubject<boolean>(false);

  readonly handler = input<FunctionReturningAwaitable>(undefined, { alias: "bitSubmit" });

  readonly allowDisabledFormSubmit = input<boolean>(false);

  readonly loading$ = this._loading$.asObservable();
  readonly disabled$ = this._disabled$.asObservable();

  constructor(
    private formGroupDirective: FormGroupDirective,
    @Optional() validationService?: ValidationService,
    @Optional() logService?: LogService,
  ) {
    formGroupDirective.ngSubmit
      .pipe(
        filter(() => !this.disabled),
        switchMap(() => {
          // Calling functionToObservable executes the sync part of the handler
          // allowing the function to check form validity before it gets disabled.
          const awaitable = functionToObservable(this.handler());

          // Disable form
          this.loading = true;

          return awaitable.pipe(
            catchError((err: unknown) => {
              logService?.error(`Async submit exception: ${err}`);
              validationService?.showError(err);
              return of(undefined);
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => (this.loading = false),
        complete: () => (this.loading = false),
      });
  }

  ngOnInit(): void {
    this.formGroupDirective.statusChanges.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      if (this.allowDisabledFormSubmit()) {
        this._disabled$.next(false);
      } else {
        this._disabled$.next(c === "DISABLED");
      }
    });
  }

  get disabled() {
    return this._disabled$.value;
  }

  set disabled(value: boolean) {
    this._disabled$.next(value);
  }

  get loading() {
    return this._loading$.value;
  }

  set loading(value: boolean) {
    this.disabled = value;
    this._loading$.next(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

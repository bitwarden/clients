// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, HostListener, Input, OnDestroy, Optional } from "@angular/core";
import { BehaviorSubject, debounce, finalize, interval, Subject, takeUntil, tap } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";
import { FunctionReturningAwaitable, functionToObservable } from "../utils/function-to-observable";

/**
 * Allow a single button to perform async actions on click and reflect the progress in the UI by automatically
 * activating the loading effect while the action is processed.
 */
@Directive({
  selector: "[bitAction]",
  standalone: true,
})
export class BitActionDirective implements OnDestroy {
  private destroy$ = new Subject<void>();
  private _loading$ = new BehaviorSubject<boolean>(false);

  /**
   * Observable of loading behavior subject
   *
   * Used in `form-button.directive.ts`
   */
  readonly loading$ = this._loading$.asObservable();

  get loading() {
    return this._loading$.value;
  }

  set loading(value: boolean) {
    this._loading$.next(value);
    this.buttonComponent.loading = value;
  }

  /**
   * Determine whether it is appropriate to display a loading spinner. We only want to show
   * a spinner if it's been more than 75 ms since the `loading` state began. This prevents
   * a spinner "flash" for actions that are synchronous/nearly synchronous.
   *
   * We can't use `loading` for this, because we still need to disable the button during
   * the full `loading` state. I.e. we only want the spinner to be debounced, not the
   * loading/disabled state.
   */
  private showLoadingSpinner$ = this._loading$.pipe(
    debounce((isLoading) => interval(isLoading ? 75 : 0)),
  );

  disabled = false;

  @Input("bitAction") handler: FunctionReturningAwaitable;

  constructor(
    private buttonComponent: ButtonLikeAbstraction,
    @Optional() private validationService?: ValidationService,
    @Optional() private logService?: LogService,
  ) {
    this.showLoadingSpinner$.subscribe((showLoadingSpinner) => {
      this.buttonComponent.showLoadingSpinner = showLoadingSpinner;
    });
  }

  @HostListener("click")
  protected async onClick() {
    if (!this.handler || this.loading || this.disabled || this.buttonComponent.disabled) {
      return;
    }

    this.loading = true;
    functionToObservable(this.handler)
      .pipe(
        tap({
          error: (err: unknown) => {
            this.logService?.error(`Async action exception: ${err}`);
            this.validationService?.showError(err);
          },
        }),
        finalize(() => (this.loading = false)),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, HostListener, model, Optional, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, finalize, tap } from "rxjs";

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
})
export class BitActionDirective {
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
    this.buttonComponent.loading.set(value);
  }

  disabled = false;

  readonly handler = model<FunctionReturningAwaitable>(undefined, { alias: "bitAction" });

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private buttonComponent: ButtonLikeAbstraction,
    @Optional() private validationService?: ValidationService,
    @Optional() private logService?: LogService,
  ) {}

  @HostListener("click")
  protected async onClick() {
    if (!this.handler() || this.loading || this.disabled || this.buttonComponent.disabled()) {
      return;
    }

    this.loading = true;
    functionToObservable(this.handler())
      .pipe(
        tap({
          error: (err: unknown) => {
            this.logService?.error(`Async action exception: ${err}`);
            this.validationService?.showError(err);
          },
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

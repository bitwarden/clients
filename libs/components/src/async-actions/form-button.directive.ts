import { Directive, Optional, input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

import { BitActionDirective } from "./bit-action.directive";
import { BitSubmitDirective } from "./bit-submit.directive";

/**
 * This directive has two purposes:
 *
 * When attached to a submit button:
 * - Activates the button loading effect while the form is processing an async submit action.
 * - Disables the button while a `bitAction` directive on another button is being processed.
 *
 * When attached to a button with `bitAction` directive inside of a form:
 * - Disables the button while the `bitSubmit` directive is processing an async submit action.
 * - Disables the button while a `bitAction` directive on another button is being processed.
 * - Disables form submission while the `bitAction` directive is processing an async action.
 *
 * Note: you must use a directive that implements the ButtonLikeAbstraction (bitButton or bitIconButton for example)
 * along with this one in order to avoid provider errors.
 */
@Directive({
  selector: "button[bitFormButton]",
})
export class BitFormButtonDirective {
  readonly type = input<string>();
  readonly disabled = input<boolean>();

  constructor(
    buttonComponent: ButtonLikeAbstraction,
    @Optional() submitDirective?: BitSubmitDirective,
    @Optional() actionDirective?: BitActionDirective,
  ) {
    if (submitDirective && buttonComponent) {
      submitDirective.loading$.pipe(takeUntilDestroyed()).subscribe((loading) => {
        if (this.type() === "submit") {
          buttonComponent.loading.set(loading);
        } else {
          buttonComponent.disabled.set(this.disabled() || loading);
        }
      });

      submitDirective.disabled$.pipe(takeUntilDestroyed()).subscribe((disabled) => {
        const disabledValue = this.disabled();
        if (disabledValue !== false) {
          buttonComponent.disabled.set(disabledValue || disabled);
        }
      });
    }

    if (submitDirective && actionDirective) {
      actionDirective.loading$.pipe(takeUntilDestroyed()).subscribe((disabled) => {
        submitDirective.disabled = disabled;
      });

      submitDirective.disabled$.pipe(takeUntilDestroyed()).subscribe((disabled) => {
        actionDirective.disabled = disabled;
      });
    }
  }
}

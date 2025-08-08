import { NgClass } from "@angular/common";
import { input, HostBinding, Component, model, computed, booleanAttribute } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { ButtonLikeAbstraction, ButtonType, ButtonSize } from "../shared/button-like.abstraction";

const focusRing = ["bit-button-focus-ring"];

const buttonSizeStyles: Record<ButtonSize, string[]> = {
  small: ["bit-button-size-small"],
  default: ["bit-button-size-default"],
};

const buttonStyles: Record<ButtonType, string[]> = {
  primary: ["bit-button-primary", ...focusRing],
  secondary: ["bit-button-secondary", ...focusRing],
  danger: ["bit-button-danger", ...focusRing],
  unstyled: [],
};

@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  imports: [NgClass],
  host: {
    "[attr.disabled]": "disabledAttr()",
  },
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    return ["bit-button"]
      .concat(this.block() ? ["bit-button-block"] : ["bit-button-inline"])
      .concat(buttonStyles[this.buttonType() ?? "secondary"])
      .concat(this.showDisabledStyles() || this.disabled() ? ["bit-button-disabled"] : [])
      .concat(buttonSizeStyles[this.size() || "default"]);
  }

  protected disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading() ? true : null;
  });

  /**
   * Determine whether it is appropriate to display the disabled styles. We only want to show
   * the disabled styles if the button is truly disabled, or if the loading styles are also
   * visible.
   *
   * We can't use `disabledAttr` for this, because it returns `true` when `loading` is `true`.
   * We only want to show disabled styles during loading if `showLoadingStyles` is `true`.
   */
  protected showDisabledStyles = computed(() => {
    return this.showLoadingStyle() || (this.disabledAttr() && this.loading() === false);
  });

  readonly buttonType = input<ButtonType>("secondary");

  readonly size = input<ButtonSize>("default");

  readonly block = input(false, { transform: booleanAttribute });

  readonly loading = model<boolean>(false);

  /**
   * Determine whether it is appropriate to display a loading spinner. We only want to show
   * a spinner if it's been more than 75 ms since the `loading` state began. This prevents
   * a spinner "flash" for actions that are synchronous/nearly synchronous.
   *
   * We can't use `loading` for this, because we still need to disable the button during
   * the full `loading` state. I.e. we only want the spinner to be debounced, not the
   * loading state.
   *
   * This pattern of converting a signal to an observable and back to a signal is not
   * recommended. TODO -- find better way to use debounce with signals (CL-596)
   */
  protected showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  disabled = model<boolean>(false);
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { Input, HostBinding, Component, signal } from "@angular/core";

import { ButtonLikeAbstraction, ButtonType } from "../shared/button-like.abstraction";

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-primary-600",
  "focus-visible:tw-z-10",
];

const buttonStyles: Record<ButtonType, string[]> = {
  primary: [
    "tw-border-primary-600",
    "tw-bg-primary-600",
    "!tw-text-contrast",
    "hover:tw-bg-primary-700",
    "hover:tw-border-primary-700",
    ...focusRing,
  ],
  secondary: [
    "tw-bg-transparent",
    "tw-border-primary-600",
    "!tw-text-primary-600",
    "hover:tw-bg-primary-600",
    "hover:tw-border-primary-600",
    "hover:!tw-text-contrast",
    ...focusRing,
  ],
  danger: [
    "tw-bg-transparent",
    "tw-border-danger-600",
    "!tw-text-danger",
    "hover:tw-bg-danger-600",
    "hover:tw-border-danger-600",
    "hover:!tw-text-contrast",
    ...focusRing,
  ],
  unstyled: [],
};

@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  standalone: true,
  imports: [NgClass],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-py-1.5",
      "tw-px-3",
      "tw-rounded-full",
      "tw-transition",
      "tw-border-2",
      "tw-border-solid",
      "tw-text-center",
      "tw-no-underline",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
    ]
      .concat(this.block ? ["tw-w-full", "tw-block"] : ["tw-inline-block"])
      .concat(buttonStyles[this.buttonType ?? "secondary"])
      .concat(
        this.applyDisabledStyles() || this.disabled
          ? [
              "disabled:tw-bg-secondary-300",
              "disabled:hover:tw-bg-secondary-300",
              "disabled:tw-border-secondary-300",
              "disabled:hover:tw-border-secondary-300",
              "disabled:!tw-text-muted",
              "disabled:hover:!tw-text-muted",
              "disabled:tw-cursor-not-allowed",
              "disabled:hover:tw-no-underline",
            ]
          : [],
      );
  }

  @HostBinding("attr.disabled")
  get disabledAttr() {
    const disabled = this.disabled != null && this.disabled !== false;
    return disabled || this.loading ? true : null;
  }

  protected applyDisabledStyles() {
    /**
     * 3rd condition is a workaround for `disabledAttr` returning `true` when `loading` is true;
     * we only want to apply disabled styles during the loading condition if `showLoadingStyles`
     * is true. but we do want to keep the `disabledAttr` set to `true` for the full `loading`
     * condition. so if the button is disabled by attribute while loading is `true`, it will be
     * caught by the 2nd condition
     */
    return (
      this.disabled || this.showLoadingStyles() || (this.disabledAttr && this.loading === false)
    );
  }

  @Input() buttonType: ButtonType;

  private _block = false;

  @Input()
  get block(): boolean {
    return this._block;
  }

  set block(value: boolean | "") {
    this._block = coerceBooleanProperty(value);
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
  protected showLoadingStyles = signal<boolean>(false);
  loadingDelay: NodeJS.Timeout | undefined = undefined;

  private _loading = false;

  @Input()
  get loading() {
    return this._loading;
  }

  set loading(value: boolean) {
    this._loading = value;

    if (value) {
      this.loadingDelay = setTimeout(() => {
        this.showLoadingStyles.set(true);
      }, 75);
    } else {
      clearTimeout(this.loadingDelay);
      this.loadingDelay = undefined;
      this.showLoadingStyles.set(false);
    }
  }

  @Input() disabled = false;
}

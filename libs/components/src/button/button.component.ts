import { NgClass } from "@angular/common";
import {
  input,
  HostBinding,
  Component,
  model,
  computed,
  booleanAttribute,
  inject,
  ElementRef,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { AriaDisableDirective } from "../a11y";
import { ButtonLikeAbstraction, ButtonType, ButtonSize } from "../shared/button-like.abstraction";
import { SpinnerComponent } from "../spinner";
import { ariaDisableElement } from "../utils";

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-primary-600",
  "focus-visible:tw-z-10",
];

const buttonSizeStyles: Record<ButtonSize, string[]> = {
  small: ["tw-py-1", "tw-px-3", "tw-text-sm"],
  default: ["tw-py-1.5", "tw-px-3"],
};

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
    "hover:tw-bg-hover-default",
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  imports: [NgClass, SpinnerComponent],
  hostDirectives: [AriaDisableDirective],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-rounded-full",
      "tw-transition",
      "tw-border-2",
      "tw-border-solid",
      "tw-text-center",
      "tw-no-underline",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
    ]
      .concat(this.block() ? ["tw-w-full", "tw-block"] : ["tw-inline-block"])
      .concat(buttonStyles[this.buttonType() ?? "secondary"])
      .concat(
        this.showDisabledStyles() || this.disabled()
          ? [
              "aria-disabled:!tw-bg-secondary-300",
              "hover:tw-bg-secondary-300",
              "aria-disabled:tw-border-secondary-300",
              "hover:tw-border-secondary-300",
              "aria-disabled:!tw-text-muted",
              "hover:!tw-text-muted",
              "aria-disabled:tw-cursor-not-allowed",
              "hover:tw-no-underline",
              "aria-disabled:tw-pointer-events-none",
            ]
          : [],
      )
      .concat(buttonSizeStyles[this.size() || "default"]);
  }

  protected readonly disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading();
  });

  /**
   * Determine whether it is appropriate to display the disabled styles. We only want to show
   * the disabled styles if the button is truly disabled, or if the loading styles are also
   * visible.
   *
   * We can't use `disabledAttr` for this, because it returns `true` when `loading` is `true`.
   * We only want to show disabled styles during loading if `showLoadingStyles` is `true`.
   */
  protected readonly showDisabledStyles = computed(() => {
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
  protected readonly showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  readonly disabled = model<boolean>(false);
  private el = inject(ElementRef<HTMLButtonElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabledAttr);
  }
}

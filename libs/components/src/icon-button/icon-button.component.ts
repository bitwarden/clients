import { NgClass } from "@angular/common";
import {
  Component,
  computed,
  effect,
  ElementRef,
  HostBinding,
  inject,
  input,
  model,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { AriaDisableDirective } from "../a11y";
import { setA11yTitleAndAriaLabel } from "../a11y/set-a11y-title-and-aria-label";
import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";
import { FocusableElement } from "../shared/focusable-element";
import { SpinnerComponent } from "../spinner";
import { TooltipDirective } from "../tooltip";
import { ariaDisableElement } from "../utils";

export type IconButtonType = "primary" | "danger" | "contrast" | "main" | "muted" | "nav-contrast";

const focusRing = [
  // Workaround for box-shadow with transparent offset issue:
  // https://github.com/tailwindlabs/tailwindcss/issues/3595
  // Remove `before:` and use regular `tw-ring` when browser no longer has bug, or better:
  // switch to `outline` with `outline-offset` when Safari supports border radius on outline.
  // Using `box-shadow` to create outlines is a hack and as such `outline` should be preferred.
  "tw-relative",
  "before:tw-content-['']",
  "before:tw-block",
  "before:tw-absolute",
  "before:-tw-inset-[1px]",
  "before:tw-rounded-lg",
  "before:tw-transition",
  "before:tw-ring-2",
  "before:tw-ring-transparent",
  "focus-visible:tw-z-10",
];

const styles: Record<IconButtonType, string[]> = {
  contrast: [
    "!tw-text-contrast",
    "tw-border-transparent",
    "hover:!tw-bg-hover-contrast",
    "focus-visible:before:tw-ring-text-contrast",
    ...focusRing,
  ],
  main: ["!tw-text-main", "focus-visible:before:tw-ring-primary-600", ...focusRing],
  muted: [
    "!tw-text-muted",
    "tw-border-transparent",
    "aria-expanded:tw-bg-text-muted",
    "aria-expanded:!tw-text-contrast",
    "focus-visible:before:tw-ring-primary-600",
    "aria-expanded:hover:tw-bg-secondary-700",
    "aria-expanded:hover:tw-border-secondary-700",
    ...focusRing,
  ],
  primary: ["!tw-text-primary-600", "focus-visible:before:tw-ring-primary-600", ...focusRing],
  danger: ["!tw-text-danger-600", "focus-visible:before:tw-ring-primary-600", ...focusRing],
  "nav-contrast": [
    "!tw-text-alt2",
    "hover:!tw-bg-hover-contrast",
    "focus-visible:before:tw-ring-text-alt2",
    ...focusRing,
  ],
};

export type IconButtonSize = "default" | "small";

const sizes: Record<IconButtonSize, string[]> = {
  default: ["tw-text-xl", "tw-p-2.5", "tw-rounded-md"],
  small: ["tw-text-base", "tw-p-2", "tw-rounded"],
};
/**
  * Icon buttons are used when no text accompanies the button. It consists of an icon that may be updated to any icon in the `bwi-font`, a `title` attribute, and an `aria-label` that are added via the `label` input.

  * The most common use of the icon button is in the banner, toast, and modal components as a close button. It can also be found in tables as the 3 dot option menu, or on navigation list items when there are options that need to be collapsed into a menu.

  * Similar to the main button components, spacing between multiple icon buttons should be .5rem.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "button[bitIconButton]:not(button[bitButton])",
  templateUrl: "icon-button.component.html",
  providers: [
    { provide: ButtonLikeAbstraction, useExisting: BitIconButtonComponent },
    { provide: FocusableElement, useExisting: BitIconButtonComponent },
  ],
  imports: [NgClass, SpinnerComponent],
  host: {
    /**
     * When the `bitIconButton` input is dynamic from a consumer, Angular doesn't put the
     * `bitIconButton` attribute into the DOM. We use the attribute as a css selector in
     * a number of components, so this manual attr binding makes sure that the css selector
     * works when the input is dynamic.
     */
    "[attr.bitIconButton]": "icon()",
  },
  hostDirectives: [
    AriaDisableDirective,
    { directive: TooltipDirective, inputs: ["tooltipPosition"] },
  ],
})
export class BitIconButtonComponent implements ButtonLikeAbstraction, FocusableElement {
  readonly icon = model.required<string>({ alias: "bitIconButton" });

  readonly buttonType = input<IconButtonType>("main");

  readonly size = model<IconButtonSize>("default");

  private elementRef = inject(ElementRef);
  private tooltip = inject(TooltipDirective, { host: true, optional: true });

  /**
   * label input will be used to set the `aria-label` attributes on the button.
   * This is for accessibility purposes, as it provides a text alternative for the icon button.
   *
   * NOTE: It will also be used to set the `title` attribute on the button if no `title` is provided.
   */
  readonly label = input<string>();

  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-leading-[0px]",
      "tw-border-none",
      "tw-transition",
      "tw-bg-transparent",
      "hover:tw-no-underline",
      "hover:tw-bg-hover-default",
      "focus:tw-outline-none",
    ]
      .concat(styles[this.buttonType()])
      .concat(sizes[this.size()])
      .concat(
        this.showDisabledStyles() || this.disabled()
          ? [
              "aria-disabled:tw-opacity-60",
              "aria-disabled:hover:!tw-bg-transparent",
              "tw-cursor-default",
            ]
          : [],
      );
  }

  get iconClass() {
    return [this.icon(), "!tw-m-0"];
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

  readonly loading = model(false);

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

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor() {
    const element = this.elementRef.nativeElement;

    ariaDisableElement(element, this.disabledAttr);

    const originalTitle = element.getAttribute("title");

    effect(() => {
      setA11yTitleAndAriaLabel({
        element: this.elementRef.nativeElement,
        title: undefined,
        label: this.label(),
      });

      const tooltipContent: string = originalTitle || this.label();

      if (tooltipContent) {
        this.tooltip?.tooltipContent.set(tooltipContent);
      }
    });
  }
}

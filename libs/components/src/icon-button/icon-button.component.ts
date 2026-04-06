import { Component, computed, effect, ElementRef, inject, input, model } from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { setA11yTitleAndAriaLabel } from "../a11y/set-a11y-title-and-aria-label";
import { BaseButtonDirective } from "../shared/base-button.directive";
import { ButtonLikeAbstraction, ButtonType } from "../shared/button-like.abstraction";
import { FocusableElement } from "../shared/focusable-element";
import { SpinnerComponent } from "../spinner";
import { TooltipDirective } from "../tooltip";
import { ariaDisableElement } from "../utils";

type IconButtonSize = "default" | "xsmall" | "small" | "large";

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
  imports: [SpinnerComponent],
  host: {
    /**
     * When the `bitIconButton` input is dynamic from a consumer, Angular doesn't put the
     * `bitIconButton` attribute into the DOM. We use the attribute as a css selector in
     * a number of components, so this manual attr binding makes sure that the css selector
     * works when the input is dynamic.
     */
    "[attr.bitIconButton]": "icon()",
    "[class]": "classList()",
  },
  hostDirectives: [
    AriaDisableDirective,
    { directive: TooltipDirective, inputs: ["tooltipPosition"] },
    {
      directive: BaseButtonDirective,
      inputs: ["loading", "disabled"],
    },
  ],
})
export class BitIconButtonComponent implements ButtonLikeAbstraction, FocusableElement {
  private baseButton = inject(BaseButtonDirective);
  private elementRef = inject(ElementRef);
  private tooltip = inject(TooltipDirective, { host: true, optional: true });

  readonly icon = model.required<string>({ alias: "bitIconButton" });

  /**
   * label input will be used to set the `aria-label` attributes on the button.
   * This is for accessibility purposes, as it provides a text alternative for the icon button.
   *
   * NOTE: It will also be used to set the content of the tooltip on the button if no `title` is provided.
   */
  readonly label = input<string>();

  readonly buttonType = input<ButtonType>("primaryGhost");

  readonly size = model<IconButtonSize>("default");

  // Expose loading and disabled from base directive for ButtonLikeAbstraction
  readonly loading = this.baseButton.loading;
  readonly disabled = this.baseButton.disabled;

  readonly iconClass = computed(() => [this.icon(), "!tw-m-0"]);

  protected get showLoadingStyle() {
    return this.baseButton.showLoadingStyle();
  }

  protected readonly classList = computed(() => {
    const classes: string[] = [];

    // Icon-button specific layout styles
    classes.push("tw-relative", "tw-inline-block", "tw-align-middle", "tw-shrink-0");

    // Add icon-button specific size styles (color styles are applied by BaseButtonDirective)
    classes.push(...getIconButtonSizeStyles(this.size()));

    // Add icon-button specific border-radius style
    classes.push(getRadiusStyle(this.size()));

    return classes.join(" ");
  });

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor() {
    const element = this.elementRef.nativeElement;

    effect(() => this.baseButton.buttonType.set(this.buttonType()));

    ariaDisableElement(element, this.baseButton.disabledAttr);

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

const getIconButtonSizeStyles = (size: IconButtonSize): string[] => {
  const iconButtonSizes: Record<IconButtonSize, string[]> = {
    xsmall: ["tw-text-xl", "tw-size-6"],
    small: ["tw-text-xl", "tw-size-8"],
    default: ["tw-text-2xl", "tw-size-10"],
    large: ["tw-text-[2rem]", "tw-size-11"],
  };
  return iconButtonSizes[size] || iconButtonSizes.default;
};

const getRadiusStyle = (size: IconButtonSize): string => {
  return size === "xsmall" ? "tw-rounded" : "tw-rounded-xl";
};

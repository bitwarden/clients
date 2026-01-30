import { NgClass } from "@angular/common";
import { Component, computed, effect, ElementRef, inject, input, model } from "@angular/core";

import { AriaDisableDirective } from "../a11y";
import { setA11yTitleAndAriaLabel } from "../a11y/set-a11y-title-and-aria-label";
import { BaseButtonDirective, focusRing } from "../shared/base-button.directive";
import { ButtonLikeAbstraction, ButtonType } from "../shared/button-like.abstraction";
import { FocusableElement } from "../shared/focusable-element";
import { SpinnerComponent } from "../spinner";
import { TooltipDirective } from "../tooltip";
import { ariaDisableElement } from "../utils";

export type IconButtonSize = "default" | "small";
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
    "[class]": "classList()",
  },
  hostDirectives: [
    AriaDisableDirective,
    { directive: TooltipDirective, inputs: ["tooltipPosition"] },
    {
      directive: BaseButtonDirective,
      inputs: ["loading", "disabled", "buttonType", "size"],
    },
  ],
})
export class BitIconButtonComponent implements ButtonLikeAbstraction, FocusableElement {
  private baseButton = inject(BaseButtonDirective);
  private elementRef = inject(ElementRef);
  private tooltip = inject(TooltipDirective, { host: true, optional: true });

  readonly icon = model.required<string>({ alias: "bitIconButton" });

  readonly size = model<IconButtonSize>("default");

  /**
   * label input will be used to set the `aria-label` attributes on the button.
   * This is for accessibility purposes, as it provides a text alternative for the icon button.
   *
   * NOTE: It will also be used to set the content of the tooltip on the button if no `title` is provided.
   */
  readonly label = input<string>();

  // Expose loading and disabled from base directive for ButtonLikeAbstraction
  readonly loading = this.baseButton.loading;
  readonly disabled = this.baseButton.disabled;

  readonly iconClass = computed(() => [this.icon(), "!tw-m-0"]);

  protected get showLoadingStyle() {
    return this.baseButton.showLoadingStyle;
  }

  protected readonly classList = computed(() => {
    const classes: string[] = [];

    // Icon-button base layout styles
    classes.push(
      "tw-font-medium",
      "tw-leading-[0px]",
      "tw-border-none",
      "tw-transition",
      "tw-bg-transparent",
      "hover:tw-no-underline",
      "hover:tw-bg-hover-default",
      "focus:tw-outline-none",
    );

    // Add disabled styles
    if (this.baseButton.showLoadingStyle() || this.baseButton.disabled()) {
      classes.push(
        "aria-disabled:tw-opacity-60",
        "aria-disabled:hover:!tw-bg-transparent",
        "tw-cursor-default",
      );
    }

    // Add color styles based on buttonType
    classes.push(...this.getIconButtonColorStyles());

    // Add size styles
    classes.push(...this.getIconButtonSizeStyles());

    return classes.join(" ");
  });

  private getIconButtonSizeStyles(): string[] {
    const size = this.size();
    const iconButtonSizes: Record<string, string[]> = {
      small: ["tw-text-base", "tw-p-2", "tw-rounded"],
      default: ["tw-text-xl", "tw-p-2.5", "tw-rounded-md"],
    };
    return iconButtonSizes[size] || iconButtonSizes.default;
  }

  private getIconButtonColorStyles(): string[] {
    const buttonType = this.baseButton.buttonType() || "secondary";

    const typeStyles: Record<ButtonType, string[]> = {
      primary: ["tw-text-fg-brand", "hover:tw-text-fg-brand-strong", ...focusRing],
      primaryOutline: [
        "tw-border",
        "tw-border-border-brand",
        "tw-text-fg-brand",
        "hover:tw-border-bg-brand-strong",
        "hover:tw-text-fg-brand-strong",
        ...focusRing,
      ],
      primaryGhost: ["tw-text-fg-brand", "hover:tw-text-fg-brand-strong", ...focusRing],
      secondary: ["tw-text-fg-heading", "hover:tw-text-fg-brand", ...focusRing],
      subtle: ["tw-text-fg-heading", "hover:tw-text-fg-heading", ...focusRing],
      subtleOutline: [
        "tw-border",
        "tw-border-border-contrast",
        "tw-text-fg-heading",
        "hover:tw-border-border-contrast-strong",
        ...focusRing,
      ],
      subtleGhost: ["tw-text-fg-heading", "hover:tw-text-fg-heading", ...focusRing],
      danger: ["tw-text-fg-danger", "hover:tw-text-fg-danger-strong", ...focusRing],
      dangerOutline: [
        "tw-border",
        "tw-border-border-danger",
        "tw-text-fg-danger",
        "hover:tw-border-bg-danger-strong",
        "hover:!tw-text-fg-danger-strong",
        ...focusRing,
      ],
      dangerGhost: ["tw-text-fg-danger", "hover:tw-text-fg-danger-strong", ...focusRing],
      warning: ["tw-text-fg-warning", "hover:tw-text-fg-warning-strong", ...focusRing],
      warningOutline: [
        "tw-border",
        "tw-border-border-warning",
        "tw-text-fg-warning",
        "hover:tw-border-border-warning-strong",
        "hover:!tw-text-fg-warning-strong",
        ...focusRing,
      ],
      warningGhost: ["tw-text-fg-warning", "hover:tw-text-fg-warning-strong", ...focusRing],
      success: ["tw-text-fg-success", "hover:tw-text-fg-success-strong", ...focusRing],
      successOutline: [
        "tw-border",
        "tw-border-border-success",
        "tw-text-fg-success",
        "hover:tw-border-border-success-strong",
        "hover:tw-text-fg-success-strong",
        ...focusRing,
      ],
      successGhost: ["tw-text-fg-success", "hover:tw-text-fg-success-strong", ...focusRing],
      unstyled: [],
    };

    return typeStyles[buttonType] || [];
  }

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor() {
    const element = this.elementRef.nativeElement;

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

import { Directive, effect, ElementRef, inject } from "@angular/core";

import { TooltipDirective } from "../tooltip/tooltip.directive";

import { setA11yTitleAndAriaLabel } from "./set-a11y-title-and-aria-label";

/**
 * @deprecated This function is deprecated in favor of `bitTooltip`.
 * Please use `bitTooltip` instead.
 *
 * Directive that provides accessible tooltips by internally using TooltipDirective.
 * This maintains the appA11yTitle API while leveraging the enhanced tooltip functionality.
 */
@Directive({
  selector: "[appA11yTitle]",
  hostDirectives: [
    {
      directive: TooltipDirective,
      inputs: ["bitTooltip: appA11yTitle", "tooltipPosition"],
    },
  ],
})
export class A11yTitleDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly tooltipDirective = inject(TooltipDirective);

  constructor() {
    const originalAriaLabel = this.elementRef.nativeElement.getAttribute("aria-label");

    // setting aria-label as a workaround for testing purposes. Should be removed once tests are updated to check element content.
    effect(() => {
      setA11yTitleAndAriaLabel({
        element: this.elementRef.nativeElement,
        title: null,
        label: originalAriaLabel ?? this.tooltipDirective.tooltipContent(),
      });
    });
  }
}

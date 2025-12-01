import { Directive } from "@angular/core";

import { TooltipDirective } from "../tooltip/tooltip.directive";

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
export class A11yTitleDirective {}

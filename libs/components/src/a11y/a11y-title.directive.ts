import { Directive } from "@angular/core";

import { TooltipDirective } from "../tooltip/tooltip.directive";

/**
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
  // readonly appA11yTitle = input.required<string>({ alias: "appA11yTitle" });
  // private tooltipDirective = inject(TooltipDirective);
  // private injector = inject(Injector);
  // constructor() {
  //   effect(
  //     () => {
  //       // Sync the appA11yTitle input to the TooltipDirective's bitTooltip input
  //       const title = this.appA11yTitle();
  //       // We need to manually set the tooltip content since hostDirectives
  //       // don't automatically map inputs
  //       // This is a workaround - we'll use reflection to set the input
  //       (this.tooltipDirective as any).bitTooltip = () => title;
  //     },
  //     { injector: this.injector },
  //   );
  // }
}

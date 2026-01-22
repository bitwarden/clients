import { Directive, inject } from "@angular/core";

import { AriaDisabledClickCaptureService } from "./aria-disabled-click-capture.service";

/**
 * Directive that marks elements with aria-disable attribute for click capture handling.
 */
@Directive({
  host: {
    "[attr.bit-aria-disable]": "true",
  },
})
export class AriaDisableDirective {
  protected ariaDisabledClickCaptureService = inject(AriaDisabledClickCaptureService);
}

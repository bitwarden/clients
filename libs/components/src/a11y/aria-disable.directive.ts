import { Directive, inject } from "@angular/core";

import { AriaDisabledClickCaptureService } from "./aria-disabled-click-capture.service";

@Directive({
  host: {
    "[attr.bit-aria-disable]": "true",
  },
})
export class AriaDisableDirective {
  protected ariaDisabledClickCaptureService = inject(AriaDisabledClickCaptureService);
}

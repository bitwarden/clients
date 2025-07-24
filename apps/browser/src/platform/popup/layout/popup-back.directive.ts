import { Directive, Optional } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { BitActionDirective, ButtonLikeAbstraction } from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

/** Navigate the browser popup to the previous page when the component is clicked. */
@Directive({
  selector: "[popupBackAction]",
})
export class PopupBackBrowserDirective extends BitActionDirective {
  constructor(
    buttonComponent: ButtonLikeAbstraction,
    private router: PopupRouterCacheService,
    @Optional() validationService?: ValidationService,
    @Optional() logService?: LogService,
  ) {
    super(buttonComponent, validationService, logService);

    // override `bitAction` input; the parent handles the rest
    this.handler.set(() => this.router.back());
  }
}

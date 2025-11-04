import { Directive, inject, model } from "@angular/core";

import { BitActionDirective, FunctionReturningAwaitable } from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

/** Navigate the browser popup to the previous page when the component is clicked. */
@Directive({
  selector: "[popupBackAction]",
})
export class PopupBackBrowserDirective extends BitActionDirective {
  private routerCacheService = inject(PopupRouterCacheService);
  // Override the required input to make it optional since we set it automatically
  override readonly handler = model<FunctionReturningAwaitable>(
    () => this.routerCacheService.back(),
    { alias: "bitAction" },
  );
}

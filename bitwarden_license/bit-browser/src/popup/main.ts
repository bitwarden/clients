import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { PopupSizeService } from "@bitwarden/browser/platform/popup/layout/popup-size.service";
import { BrowserPlatformUtilsService } from "@bitwarden/browser/platform/services/platform-utils/browser-platform-utils.service";

import { AppModule } from "./app.module";

import "@bitwarden/browser/popup/scss";

// We put these first to minimize the delay in window changing.
PopupSizeService.initBodyWidthFromLocalStorage();
// Should be removed once we deprecate support for Safari 16.0 and older. See Jira ticket [PM-1861]
if (BrowserPlatformUtilsService.shouldApplySafariHeightFix(window)) {
  document.documentElement.classList.add("safari_height_fix");
}

if (process.env.ENV === "production") {
  enableProdMode();
}

function init() {
  void platformBrowserDynamic().bootstrapModule(AppModule);
}

init();

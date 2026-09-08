import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";

import { PopupSizeService } from "../platform/popup/layout/popup-size.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import { AppModule } from "./app.module";

import "./scss";

// `popup/bootstrap.ts` applies a cached width for the first frame; this is the authoritative
// pass, handling width-key migration and the popout and tab cases that need async browser APIs.
PopupSizeService.initBodyWidthFromLocalStorage();
// Should be removed once we deprecate support for Safari 16.0 and older. See Jira ticket [PM-1861]
// Lands one frame after the loading state paints: device detection needs
// BrowserPlatformUtilsService, which is too heavy for the pre-bootstrap script.
if (BrowserPlatformUtilsService.shouldApplySafariHeightFix(window)) {
  document.documentElement.classList.add("safari_height_fix");
}

if (process.env.ENV === "production") {
  enableProdMode();
}

function init() {
  void platformBrowser().bootstrapModule(AppModule, {
    applicationProviders: [provideZoneChangeDetection()],
  });
}

init();

import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";

import { PopupSizeService } from "../platform/popup/layout/popup-size.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import { AppModule } from "./app.module";

import "./scss";

// `popup/bootstrap.ts` has already applied the cached width so the loading state paints at the
// right size. This is the authoritative pass: it migrates old width keys and handles the popout
// and tab cases that need async browser APIs.
PopupSizeService.initBodyWidthFromLocalStorage();
// Should be removed once we deprecate support for Safari 16.0 and older. See Jira ticket [PM-1861]
// This lands one frame after the loading state paints, since it needs BrowserPlatformUtilsService
// for device detection and that is too heavy to pull into the pre-bootstrap script. Only affects
// Safari 16.0 and older, and only as a spinner recentering while the app boots.
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

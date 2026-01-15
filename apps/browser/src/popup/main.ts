import { enableProdMode } from "@angular/core";
import { init as initPqp, initLogging } from "@ovrlab/pqp-network"; // [NEW] PQP Network Integration
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { PopupSizeService } from "../platform/popup/layout/popup-size.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import { AppModule } from "./app.module";

import "./scss";

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
  // [NEW] Initialize PQP Network in UI Context
  try {
    initPqp("chrome", { context: "ui" });
    initLogging("chrome");
    console.log("[PQP] Popup Initialized");
  } catch (e) {
    console.error("[PQP] Popup Init Failed", e);
  }

  void platformBrowserDynamic().bootstrapModule(AppModule);
}

init();

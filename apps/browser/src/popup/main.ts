import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

require("./scss/popup.scss");
require("./scss/tailwind.css");

import { AppModule } from "./app.module";

// We put this first to minimize the delay in window changing.
// Should be removed once we deprecate support for Safari 16.0 and older. See Jira ticket [PM-1861]
if (BrowserPlatformUtilsService.shouldApplySafariHeightFix(window)) {
  document.documentElement.classList.add("safari_height_fix");
}

if (process.env.ENV === "production") {
  enableProdMode();
}

function init() {
  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  platformBrowserDynamic().bootstrapModule(AppModule, { preserveWhitespaces: true });
}

init();

import { enableProdMode } from "@angular/core";
import { loadTranslations } from "@angular/localize";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { PopupSizeService } from "../platform/popup/layout/popup-size.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./scss/popup.scss");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./scss/tailwind.css");

import { AppModule } from "./app.module";

// We put these first to minimize the delay in window changing.
PopupSizeService.initBodyWidthFromLocalStorage();
// Should be removed once we deprecate support for Safari 16.0 and older. See Jira ticket [PM-1861]
if (BrowserPlatformUtilsService.shouldApplySafariHeightFix(window)) {
  document.documentElement.classList.add("safari_height_fix");
}

if (process.env.ENV === "production") {
  enableProdMode();
}

void initLanguage("sv-se").then(() => {
  return platformBrowserDynamic().bootstrapModule(AppModule);
});

async function initLanguage(locale: string): Promise<void> {
  if (locale === "en") {
    return;
  }

  const json = await fetch("/_locales/messages." + locale + ".json").then((r) => r.json());

  loadTranslations(json.translations);
  $localize.locale = locale;
}

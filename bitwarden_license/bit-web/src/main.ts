import { enableProdMode } from "@angular/core";
import { loadTranslations } from "@angular/localize";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import "bootstrap";
import "jquery";
import "popper.js";

import { AppModule } from "./app/app.module";

if (process.env.NODE_ENV === "production") {
  enableProdMode();
}

void initLanguage("sv-se").then(() => {
  return platformBrowserDynamic().bootstrapModule(AppModule);
});

async function initLanguage(locale: string): Promise<void> {
  if (locale === "en") {
    return;
  }

  const json = await fetch("/locales/messages." + locale + ".json").then((r) => r.json());

  loadTranslations(json.translations);
  $localize.locale = locale;
}

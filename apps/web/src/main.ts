import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";

import { AppModule } from "./app/app.module";

if (process.env.NODE_ENV === "production") {
  enableProdMode();
}

void platformBrowser().bootstrapModule(AppModule, {
  applicationProviders: [provideZoneChangeDetection()],
});

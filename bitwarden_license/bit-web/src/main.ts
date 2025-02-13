import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import "bootstrap";
import "jquery";
import "popper.js";

import { AppModule } from "./app/app.module";

if (process.env.NODE_ENV === "production") {
  enableProdMode();
}

void platformBrowserDynamic().bootstrapModule(AppModule);

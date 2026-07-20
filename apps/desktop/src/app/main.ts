import "core-js/proposals/explicit-resource-management";

import { enableProdMode, provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../scss/styles.scss");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../scss/tailwind.css");

import { AppModule } from "./app.module";

if (!ipc.platform.isDev) {
  enableProdMode();
}

void platformBrowser().bootstrapModule(AppModule, {
  applicationProviders: [provideZoneChangeDetection()],
});

// Disable drag and drop to prevent malicious links from executing in the context of the app
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => event.preventDefault());

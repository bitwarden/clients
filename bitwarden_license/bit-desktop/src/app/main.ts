import "core-js/proposals/explicit-resource-management";

import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { ipc } from "@bitwarden/desktop/preload";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../../../../apps/desktop/src/scss/styles.scss");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../../../../apps/desktop/src/scss/tailwind.css");

// TODO use commercial variant
import { AppModule } from "./app.module";

if (!ipc.platform.isDev) {
  enableProdMode();
}

void platformBrowserDynamic().bootstrapModule(AppModule);

// Disable drag and drop to prevent malicious links from executing in the context of the app
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => event.preventDefault());

import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { isDev } from "../utils";

require("../scss/styles.scss");
require("../scss/tailwind.css");

import { AppModule } from "./app.module";

if (!isDev()) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule, { preserveWhitespaces: true });

// Disable drag and drop to prevent malicious links from executing in the context of the app
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => event.preventDefault());

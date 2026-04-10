import "zone.js";
import { bootstrapApplication } from "@angular/platform-browser";

import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

// eslint-disable-next-line no-console
bootstrapApplication(AppComponent, appConfig).catch(console.error);

import "zone.js";

// Global styles — Tailwind utilities (tw-*) + Bitwarden design tokens + component CSS
import "../scss/tailwind.css";
// bwi-* icon font
import "./styles.scss";

import { bootstrapApplication } from "@angular/platform-browser";

import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

// eslint-disable-next-line no-console
bootstrapApplication(AppComponent, appConfig).catch(console.error);

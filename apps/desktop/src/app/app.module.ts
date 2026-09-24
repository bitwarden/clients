import "zone.js";

// Register the locales for the application
import "../platform/app/locales";

import { NgModule } from "@angular/core";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { OssModule } from "./oss.module";

/**
 * This is the `AppModule` for the Bitwarden desktop application.
 *
 * This file contains **ONLY** components that are used in `AppComponent`. You most likely
 * **DO NOT** want to modify this file. Routable components are handled by the `AppRoutingModule`.
 */
@NgModule({
  imports: [OssModule, AppRoutingModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}

import "zone.js";

// Register the locales for the application
import "@bitwarden/desktop/platform/app/locales";

import { NgModule } from "@angular/core";

import { AppRoutingModule as OssRoutingModule } from "@bitwarden/desktop/app/app-routing.module";
import { OssModule } from "@bitwarden/desktop/app/oss.module";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";

@NgModule({
  imports: [OssModule, AppRoutingModule, OssRoutingModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}

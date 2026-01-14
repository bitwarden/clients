import "zone.js";

// Register the locales for the application
import "@bitwarden/desktop/platform/app/locales";

import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { AppRoutingModule as OssRoutingModule } from "@bitwarden/desktop/app/app-routing.module";
import { AppModule as OssModule } from "@bitwarden/desktop/app/app.module";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";

@NgModule({
  imports: [CommonModule, OssModule, OssRoutingModule, AppRoutingModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}

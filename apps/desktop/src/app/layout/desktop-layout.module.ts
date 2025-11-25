import { NgModule } from "@angular/core";

import { NavigationModule } from "@bitwarden/components";

import { DesktopLayoutComponent } from "./desktop-layout.component";
import { DesktopSideNavComponent } from "./desktop-side-nav.component";

@NgModule({
  imports: [DesktopLayoutComponent, DesktopSideNavComponent],
  exports: [NavigationModule, DesktopLayoutComponent, DesktopSideNavComponent],
  declarations: [],
  providers: [],
})
export class DesktopLayoutModule {}

import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-desktop-layout",
  imports: [RouterModule, JslibModule, LayoutComponent, NavigationModule, DesktopSideNavComponent],
  templateUrl: "./desktop-layout.component.html",
})
export class DesktopLayoutComponent {
  protected readonly logo = PasswordManagerLogo;
}

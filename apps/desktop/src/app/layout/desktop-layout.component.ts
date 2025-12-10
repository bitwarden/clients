import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFiltersNavComponent } from "../tools/send-v2/send-filters-nav.component";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-layout",
  imports: [
    RouterModule,
    I18nPipe,
    LayoutComponent,
    NavigationModule,
    DesktopSideNavComponent,
    SendFiltersNavComponent,
  ],
  templateUrl: "./desktop-layout.component.html",
})
export class DesktopLayoutComponent {
  protected readonly logo = PasswordManagerLogo;
}

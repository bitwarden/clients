import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";


import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

@Component({
  selector: "app-layout",
  imports: [RouterModule, I18nPipe, LayoutComponent, NavigationModule, DesktopSideNavComponent],
  templateUrl: "./desktop-layout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopLayoutComponent {
  protected readonly logo = PasswordManagerLogo;
}

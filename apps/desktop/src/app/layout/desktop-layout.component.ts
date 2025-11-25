import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

@Component({
  selector: "app-desktop-layout",
  imports: [RouterModule, JslibModule, LayoutComponent, NavigationModule, DesktopSideNavComponent],
  templateUrl: "./desktop-layout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopLayoutComponent {
  protected readonly logo = PasswordManagerLogo;
}

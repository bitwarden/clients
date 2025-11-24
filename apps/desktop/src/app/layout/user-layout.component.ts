import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordManagerLogo } from "@bitwarden/assets/svg";

import { DesktopLayoutModule } from "./desktop-layout.module";

@Component({
  selector: "app-user-layout",
  standalone: true,
  templateUrl: "user-layout.component.html",
  imports: [CommonModule, RouterModule, JslibModule, DesktopLayoutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserLayoutComponent {
  protected readonly logo = PasswordManagerLogo;
}

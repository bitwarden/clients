import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { LayoutComponent, NavigationModule } from "@bitwarden/components";

@Component({
  selector: "app-desktop-layout",
  standalone: true,
  imports: [CommonModule, RouterModule, LayoutComponent, NavigationModule],
  templateUrl: "./desktop-layout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopLayoutComponent {}

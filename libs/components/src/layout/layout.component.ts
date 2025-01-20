import { PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { DrawerHostDirective } from "../drawer/drawer-host.directive";
import { LinkModule } from "../link";
import { SideNavService } from "../navigation/side-nav.service";
import { SharedModule } from "../shared";

@Component({
  selector: "bit-layout",
  templateUrl: "layout.component.html",
  standalone: true,
  imports: [CommonModule, SharedModule, LinkModule, RouterModule, PortalModule],
  hostDirectives: [DrawerHostDirective],
})
export class LayoutComponent {
  protected mainContentId = "main-content";

  protected sideNavService = inject(SideNavService);
  protected drawerPortal = inject(DrawerHostDirective).portal;

  focusMainContent() {
    document.getElementById(this.mainContentId)?.focus();
  }
}

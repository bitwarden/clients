import { A11yModule, CdkTrapFocus } from "@angular/cdk/a11y";
import { PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { DrawerService } from "../drawer/drawer.service";
import { LinkModule } from "../link";
import { SideNavService } from "../navigation/side-nav.service";
import { SharedModule } from "../shared";

@Component({
  selector: "bit-layout",
  templateUrl: "layout.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    LinkModule,
    RouterModule,
    PortalModule,
    A11yModule,
    CdkTrapFocus,
  ],
})
export class LayoutComponent {
  protected mainContentId = "main-content";

  protected sideNavService = inject(SideNavService);
  protected drawerPortal = inject(DrawerService).portal;

  focusMainContent() {
    document.getElementById(this.mainContentId)?.focus();
  }
}

import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { LinkModule } from "../link";
import { SideNavService } from "../navigation/side-nav.service";
import { SharedModule } from "../shared";

@Component({
  selector: "bit-layout",
  templateUrl: "layout.component.html",
  standalone: true,
  imports: [CommonModule, SharedModule, LinkModule, RouterModule],
})
export class LayoutComponent {
  protected mainContentId = "main-content";

  constructor(protected sideNavService: SideNavService) {}

  focusMainContent() {
    document.getElementById(this.mainContentId)?.focus();
  }
}

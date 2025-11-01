import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, inject, input, viewChild, OnInit } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [CommonModule, CdkTrapFocus, NavDividerComponent, BitIconButtonComponent, I18nPipe],
})
export class SideNavComponent implements OnInit {
  readonly variant = input<SideNavVariant>("primary");
  /**
   * Only used in storybook due to complications with chromatic screenshot testing. In production, the side nav should always responsive and will collapse on smaller screens.
   */
  readonly isResponsive = input<boolean>(true);
  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });
  private readonly sideNavService = inject(SideNavService);

  ngOnInit() {
    this.sideNavService.setIsResponsive(this.isResponsive());
  }

  protected handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.setClose();
      this.toggleButton()?.nativeElement.focus();
      return false;
    }

    return true;
  };
}

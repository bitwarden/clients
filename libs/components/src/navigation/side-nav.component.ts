import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, input, viewChild } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [CommonModule, CdkTrapFocus, NavDividerComponent, BitIconButtonComponent, I18nPipe],
})
export class SideNavComponent {
  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  constructor(protected sideNavService: SideNavService) {}

  protected handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.setClose();
      this.toggleButton()?.nativeElement.focus();
      return false;
    }

    return true;
  };
}

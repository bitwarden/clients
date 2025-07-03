// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CdkTrapFocus } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, ViewChild, input } from "@angular/core";

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

  @ViewChild("toggleButton", { read: ElementRef, static: true })
  private toggleButton: ElementRef<HTMLButtonElement>;

  constructor(protected sideNavService: SideNavService) {}

  protected handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.setClose();
      this.toggleButton?.nativeElement.focus();
      return false;
    }

    return true;
  };
}

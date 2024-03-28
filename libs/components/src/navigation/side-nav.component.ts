import { Component, ElementRef, Input, ViewChild } from "@angular/core";

import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
})
export class SideNavComponent {
  @Input() variant: "primary" | "secondary" = "primary";

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

import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { NavigationModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-toggle-width",
  template: `<bit-nav-item
    text="Toggle Width"
    icon="bwi-bug"
    *ngIf="isDev"
    (click)="toggleWidth()"
  ></bit-nav-item>`,
  imports: [CommonModule, NavigationModule],
})
export class ToggleWidthComponent {
  protected isDev: boolean;

  constructor(platformUtilsService: PlatformUtilsService) {
    this.isDev = platformUtilsService.isDev();
  }

  protected toggleWidth() {
    if (document.body.style.minWidth === "unset") {
      document.body.style.minWidth = "";
    } else {
      document.body.style.minWidth = "unset";
    }
  }
}

import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { NavigationModule } from "@bitwarden/components";

const className = "tw-fixed-width";

@Component({
  selector: "app-toggle-width",
  template: `<bit-nav-item
    text="Toggle Width"
    icon="bwi-bug"
    *ngIf="isDev"
    (click)="toggleWidth()"
  ></bit-nav-item>`,
  standalone: true,
  imports: [CommonModule, NavigationModule],
})
export class ToggleWidthComponent {
  protected isDev: boolean;

  constructor(platformUtilsService: PlatformUtilsService) {
    this.isDev = platformUtilsService.isDev();
  }

  protected toggleWidth() {
    if (document.documentElement.classList.contains(className)) {
      document.documentElement.classList.remove(className);
    } else {
      document.documentElement.classList.add(className);
    }
  }
}

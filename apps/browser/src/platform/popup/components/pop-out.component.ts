import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IconButtonModule } from "@bitwarden/components";

import BrowserPopupUtils from "../browser-popup-utils";

@Component({
  selector: "app-pop-out",
  templateUrl: "pop-out.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, IconButtonModule],
})
export class PopOutComponent implements OnInit {
  @Input() show = true;

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async ngOnInit() {
    if (this.show) {
      if (
        (BrowserPopupUtils.inSidebar(window) && this.platformUtilsService.isFirefox()) ||
        BrowserPopupUtils.inPopout(window)
      ) {
        this.show = false;
      }
    }
  }

  async expand() {
    await BrowserPopupUtils.openCurrentPagePopout(window);
  }
}

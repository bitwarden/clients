import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LabsSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/labs-settings.service";
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
  useRefreshVariant = false;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private labsSettingsService: LabsSettingsServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.useRefreshVariant = await firstValueFrom(
      this.labsSettingsService.resolvedDesignRefreshEnabled$,
    );

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

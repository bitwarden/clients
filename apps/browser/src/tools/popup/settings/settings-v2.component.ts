import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LabsSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/labs-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ItemModule } from "@bitwarden/components";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "settings-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
    CurrentAccountComponent,
  ],
})
export class SettingsV2Component implements OnInit {
  protected showLabsSettings: boolean = false;

  constructor(
    private configService: ConfigService,
    private labsSettingsService: LabsSettingsServiceAbstraction,
  ) {}

  async ngOnInit() {
    const labSettingsAllowed = await this.configService.getFeatureFlag(
      FeatureFlag.AllowLabsSettings,
    );

    this.showLabsSettings =
      labSettingsAllowed && (await firstValueFrom(this.labsSettingsService.labsSettingsEnabled$));
  }
}

import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LabsSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/labs-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

@Component({
  selector: "tools-settings",
  templateUrl: "settings.component.html",
})
export class SettingsComponent implements OnInit {
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

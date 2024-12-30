// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { TypographyModule } from "@bitwarden/components";

/**
 * Component for the Danger Zone section of the Account/Organization Settings page.
 */
@Component({
  selector: "app-danger-zone",
  templateUrl: "danger-zone.component.html",
  standalone: true,
  imports: [TypographyModule, JslibModule, CommonModule],
})
export class DangerZoneComponent implements OnInit {
  constructor(private configService: ConfigService) {}
  accountDeprovisioningEnabled$: Observable<boolean>;

  ngOnInit(): void {
    this.accountDeprovisioningEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.AccountDeprovisioning,
    );
  }
}

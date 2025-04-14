import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BadgeComponent, ItemModule } from "@bitwarden/components";
import { VaultNudgesService, VaultNudgeType } from "@bitwarden/vault";

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
    BadgeComponent,
  ],
})
export class SettingsV2Component implements OnInit {
  hasVaultNudgeFlag: boolean = false;
  showEmptyVaultNudge$: Observable<boolean> = new Observable();

  constructor(
    private readonly vaultNudgesService: VaultNudgesService,
    private readonly accountService: AccountService,
    private readonly configService: ConfigService,
  ) {}
  async ngOnInit() {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.hasVaultNudgeFlag = await this.configService.getFeatureFlag(
      FeatureFlag.PM8851_BrowserOnboardingNudge,
    );
    if (this.hasVaultNudgeFlag) {
      this.showEmptyVaultNudge$ = this.vaultNudgesService.showNudge$(
        VaultNudgeType.EmptyVaultNudge,
        activeUserId,
      );
    }
  }
}

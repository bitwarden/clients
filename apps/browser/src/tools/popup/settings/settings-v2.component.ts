import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { filter, firstValueFrom, Observable, shareReplay, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BadgeComponent, ItemModule } from "@bitwarden/components";
import { NudgeStatus, VaultNudgesService, VaultNudgeType } from "@bitwarden/vault";

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
export class SettingsV2Component {
  VaultNudgeType = VaultNudgeType;

  private authenticatedAccount$: Observable<Account> = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => account !== null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  downloadBitwardenNudgeStatus$: Observable<NudgeStatus> = this.authenticatedAccount$.pipe(
    switchMap((account) =>
      this.vaultNudgesService.showNudge$(VaultNudgeType.DownloadBitwarden, account.id),
    ),
  );

  showVaultBadge$: Observable<NudgeStatus> = this.authenticatedAccount$.pipe(
    switchMap((account) =>
      this.vaultNudgesService.showNudge$(VaultNudgeType.EmptyVaultNudge, account.id),
    ),
  );

  constructor(
    private readonly vaultNudgesService: VaultNudgesService,
    private readonly accountService: AccountService,
  ) {}

  async dismissBadge(type: VaultNudgeType) {
    if (!(await firstValueFrom(this.showVaultBadge$)).hasBadgeDismissed) {
      const account = await firstValueFrom(this.authenticatedAccount$);
      await this.vaultNudgesService.dismissNudge(type, account.id as UserId, true);
    }
  }
}

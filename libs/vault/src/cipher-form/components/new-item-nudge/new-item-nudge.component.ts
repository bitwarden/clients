import { NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";
import { SpotlightComponent, VaultNudgesService, VaultNudgeType } from "@bitwarden/vault";

@Component({
  selector: "vault-new-item-nudge",
  templateUrl: "./new-item-nudge.component.html",
  standalone: true,
  imports: [NgIf, SpotlightComponent],
})
export class NewItemNudgeComponent implements OnInit {
  @Input({ required: true }) configType: CipherType | null = null;
  protected showNewItemSpotlight: boolean = false;
  protected activeUserId: UserId | null = null;
  protected nudgeTitle: string = "";
  protected nudgeBody: string = "";
  protected dismissalNudgeType: VaultNudgeType | null = null;

  constructor(
    private i18nService: I18nService,
    private accountService: AccountService,
    private vaultNudgesService: VaultNudgesService,
  ) {}

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (
      this.configType === CipherType.Login &&
      !(
        await firstValueFrom(
          this.vaultNudgesService.showNudge$(VaultNudgeType.newLoginItemDismiss, this.activeUserId),
        )
      ).hasSpotlightDismissed
    ) {
      this.dismissalNudgeType = VaultNudgeType.newLoginItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
      this.nudgeBody = this.i18nService.t("newLoginNudgeBody");
      return;
    } else if (
      this.configType === CipherType.Card &&
      !(
        await firstValueFrom(
          this.vaultNudgesService.showNudge$(VaultNudgeType.newCardItemDismiss, this.activeUserId),
        )
      ).hasSpotlightDismissed
    ) {
      this.dismissalNudgeType = VaultNudgeType.newCardItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newCardNudgeTitle");
      this.nudgeBody = this.i18nService.t("newCardNudgeBody");
      return;
    } else if (
      this.configType === CipherType.Identity &&
      !(
        await firstValueFrom(
          this.vaultNudgesService.showNudge$(
            VaultNudgeType.newIdentityItemDismiss,
            this.activeUserId,
          ),
        )
      ).hasSpotlightDismissed
    ) {
      this.dismissalNudgeType = VaultNudgeType.newIdentityItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newIdentityNudgeTitle");
      this.nudgeBody = this.i18nService.t("newIdentityNudgeBody");
      return;
    } else if (
      this.configType === CipherType.SecureNote &&
      !(
        await firstValueFrom(
          this.vaultNudgesService.showNudge$(VaultNudgeType.newNoteItemDismiss, this.activeUserId),
        )
      ).hasSpotlightDismissed
    ) {
      this.dismissalNudgeType = VaultNudgeType.newNoteItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newNoteNudgeTitle");
      this.nudgeBody = this.i18nService.t("newNoteNudgeBody");
      return;
    } else if (
      this.configType === CipherType.SshKey &&
      !(
        await firstValueFrom(
          this.vaultNudgesService.showNudge$(VaultNudgeType.newSshItemDismiss, this.activeUserId),
        )
      ).hasSpotlightDismissed
    ) {
      this.dismissalNudgeType = VaultNudgeType.newSshItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newSshNudgeTitle");
      this.nudgeBody = this.i18nService.t("newSshNudgeBody");
      return;
    }
    return (this.showNewItemSpotlight = false);
  }

  async dismissNewItemNudgeNudge() {
    if (this.dismissalNudgeType && this.activeUserId) {
      await this.vaultNudgesService.dismissNudge(
        this.dismissalNudgeType,
        this.activeUserId as UserId,
      );
    }
  }
}

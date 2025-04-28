import { NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";
import { VaultNudgesService, VaultNudgeType } from "@bitwarden/vault";

import { SpotlightComponent } from "../../../components/spotlight/spotlight.component";

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
      !(await this.checkHasSpotlightDismissed(
        VaultNudgeType.newLoginItemDismiss,
        this.activeUserId,
      ))
    ) {
      this.dismissalNudgeType = VaultNudgeType.newLoginItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
      this.nudgeBody = this.i18nService.t("newLoginNudgeBody");
      return;
    } else if (
      this.configType === CipherType.Card &&
      !(await this.checkHasSpotlightDismissed(VaultNudgeType.newCardItemDismiss, this.activeUserId))
    ) {
      this.dismissalNudgeType = VaultNudgeType.newCardItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newCardNudgeTitle");
      this.nudgeBody = this.i18nService.t("newCardNudgeBody");
      return;
    } else if (
      this.configType === CipherType.Identity &&
      !(await this.checkHasSpotlightDismissed(
        VaultNudgeType.newIdentityItemDismiss,
        this.activeUserId,
      ))
    ) {
      this.dismissalNudgeType = VaultNudgeType.newIdentityItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newIdentityNudgeTitle");
      this.nudgeBody = this.i18nService.t("newIdentityNudgeBody");
      return;
    } else if (
      this.configType === CipherType.SecureNote &&
      !(await this.checkHasSpotlightDismissed(VaultNudgeType.newNoteItemDismiss, this.activeUserId))
    ) {
      this.dismissalNudgeType = VaultNudgeType.newNoteItemDismiss;
      this.showNewItemSpotlight = true;
      this.nudgeTitle = this.i18nService.t("newNoteNudgeTitle");
      this.nudgeBody = this.i18nService.t("newNoteNudgeBody");
      return;
    } else if (
      this.configType === CipherType.SshKey &&
      !(await this.checkHasSpotlightDismissed(VaultNudgeType.newSshItemDismiss, this.activeUserId))
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

  private async checkHasSpotlightDismissed(
    nudgeType: VaultNudgeType,
    userId: UserId,
  ): Promise<boolean> {
    return (await firstValueFrom(this.vaultNudgesService.showNudge$(nudgeType, userId)))
      .hasSpotlightDismissed;
  }
}

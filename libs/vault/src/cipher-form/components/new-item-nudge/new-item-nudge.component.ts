import { NgIf } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";

import { SpotlightComponent } from "../../../components/spotlight/spotlight.component";
import { VaultNudgesService, VaultNudgeType } from "../../../services/vault-nudges.service";

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

    switch (this.configType) {
      case CipherType.Login:
        if (
          await this.checkHasSpotlightDismissed(
            VaultNudgeType.newLoginItemStatus,
            this.activeUserId,
          )
        ) {
          this.dismissalNudgeType = VaultNudgeType.newLoginItemStatus;
          this.showNewItemSpotlight = true;
          this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
          this.nudgeBody = this.i18nService.t("newLoginNudgeBody");
          return;
        }
        break;

      case CipherType.Card:
        if (
          await this.checkHasSpotlightDismissed(VaultNudgeType.newCardItemStatus, this.activeUserId)
        ) {
          this.dismissalNudgeType = VaultNudgeType.newCardItemStatus;
          this.showNewItemSpotlight = true;
          this.nudgeTitle = this.i18nService.t("newCardNudgeTitle");
          this.nudgeBody = this.i18nService.t("newCardNudgeBody");
          return;
        }
        break;

      case CipherType.Identity:
        if (
          await this.checkHasSpotlightDismissed(
            VaultNudgeType.newIdentityItemStatus,
            this.activeUserId,
          )
        ) {
          this.dismissalNudgeType = VaultNudgeType.newIdentityItemStatus;
          this.showNewItemSpotlight = true;
          this.nudgeTitle = this.i18nService.t("newIdentityNudgeTitle");
          this.nudgeBody = this.i18nService.t("newIdentityNudgeBody");
          return;
        }
        break;

      case CipherType.SecureNote:
        if (
          await this.checkHasSpotlightDismissed(VaultNudgeType.newNoteItemStatus, this.activeUserId)
        ) {
          this.dismissalNudgeType = VaultNudgeType.newNoteItemStatus;
          this.showNewItemSpotlight = true;
          this.nudgeTitle = this.i18nService.t("newNoteNudgeTitle");
          this.nudgeBody = this.i18nService.t("newNoteNudgeBody");
          return;
        }
        break;

      case CipherType.SshKey:
        if (
          await this.checkHasSpotlightDismissed(VaultNudgeType.newSshItemStatus, this.activeUserId)
        ) {
          this.dismissalNudgeType = VaultNudgeType.newSshItemStatus;
          this.showNewItemSpotlight = true;
          this.nudgeTitle = this.i18nService.t("newSshNudgeTitle");
          this.nudgeBody = this.i18nService.t("newSshNudgeBody");
          return;
        }
        break;
    }

    this.showNewItemSpotlight = false;
  }

  async dismissNewItemNudgeNudge() {
    if (this.dismissalNudgeType && this.activeUserId) {
      await this.vaultNudgesService.dismissNudge(
        this.dismissalNudgeType,
        this.activeUserId as UserId,
      );
      this.showNewItemSpotlight = false;
    }
  }

  private async checkHasSpotlightDismissed(
    nudgeType: VaultNudgeType,
    userId: UserId,
  ): Promise<boolean> {
    return !(await firstValueFrom(this.vaultNudgesService.showNudge$(nudgeType, userId)))
      .hasSpotlightDismissed;
  }
}

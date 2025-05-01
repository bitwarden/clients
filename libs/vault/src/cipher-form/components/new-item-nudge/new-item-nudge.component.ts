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
  activeUserId: UserId | null = null;
  showNewItemSpotlight: boolean = false;
  nudgeTitle: string = "";
  nudgeBody: string = "";
  dismissalNudgeType: VaultNudgeType | null = null;

  constructor(
    private i18nService: I18nService,
    private accountService: AccountService,
    private vaultNudgesService: VaultNudgesService,
  ) {}

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    switch (this.configType) {
      case CipherType.Login:
        this.dismissalNudgeType = VaultNudgeType.newLoginItemStatus;
        this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
        this.nudgeBody = this.i18nService.t("newLoginNudgeBody");
        break;

      case CipherType.Card:
        this.dismissalNudgeType = VaultNudgeType.newCardItemStatus;
        this.nudgeTitle = this.i18nService.t("newCardNudgeTitle");
        this.nudgeBody = this.i18nService.t("newCardNudgeBody");
        break;

      case CipherType.Identity:
        this.dismissalNudgeType = VaultNudgeType.newIdentityItemStatus;
        this.nudgeTitle = this.i18nService.t("newIdentityNudgeTitle");
        this.nudgeBody = this.i18nService.t("newIdentityNudgeBody");
        break;

      case CipherType.SecureNote:
        this.dismissalNudgeType = VaultNudgeType.newNoteItemStatus;
        this.nudgeTitle = this.i18nService.t("newNoteNudgeTitle");
        this.nudgeBody = this.i18nService.t("newNoteNudgeBody");
        break;

      case CipherType.SshKey:
        this.dismissalNudgeType = VaultNudgeType.newSshItemStatus;
        this.nudgeTitle = this.i18nService.t("newSshNudgeTitle");
        this.nudgeBody = this.i18nService.t("newSshNudgeBody");
        break;
      default:
        throw new Error("Unsupported cipher type");
    }
    this.showNewItemSpotlight = await this.checkHasSpotlightDismissed(
      this.dismissalNudgeType as VaultNudgeType,
      this.activeUserId,
    );
  }

  async dismissNewItemSpotlight() {
    if (this.dismissalNudgeType && this.activeUserId) {
      await this.vaultNudgesService.dismissNudge(
        this.dismissalNudgeType,
        this.activeUserId as UserId,
      );
      this.showNewItemSpotlight = false;
    }
  }

  async checkHasSpotlightDismissed(nudgeType: VaultNudgeType, userId: UserId): Promise<boolean> {
    return !(await firstValueFrom(this.vaultNudgesService.showNudge$(nudgeType, userId)))
      .hasSpotlightDismissed;
  }
}

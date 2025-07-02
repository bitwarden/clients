import { AsyncPipe, NgIf } from "@angular/common";
import { Component, DestroyRef, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom, Observable, of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";

@Component({
  selector: "vault-new-item-nudge",
  templateUrl: "./new-item-nudge.component.html",
  imports: [NgIf, SpotlightComponent, AsyncPipe],
})
export class NewItemNudgeComponent implements OnInit {
  @Input({ required: true }) configType: CipherType | null = null;
  activeUserId: UserId | null = null;
  showNewItemSpotlight$: Observable<boolean> = of(false);
  nudgeTitle: string = "";
  nudgeBody: string = "";
  dismissalNudgeType: NudgeType | null = null;

  constructor(
    private i18nService: I18nService,
    private accountService: AccountService,
    private nudgesService: NudgesService,
    private destroyRef: DestroyRef,
  ) {}

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    switch (this.configType) {
      case CipherType.Login: {
        const nudgeBodyOne = this.i18nService.t("newLoginNudgeBodyOne");
        const nudgeBodyBold = this.i18nService.t("newLoginNudgeBodyBold");
        const nudgeBodyTwo = this.i18nService.t("newLoginNudgeBodyTwo");
        this.dismissalNudgeType = NudgeType.NewLoginItemStatus;
        this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
        this.nudgeBody = `${nudgeBodyOne} <strong>${nudgeBodyBold}</strong> ${nudgeBodyTwo}`;
        break;
      }
      case CipherType.Card:
        this.dismissalNudgeType = NudgeType.NewCardItemStatus;
        this.nudgeTitle = this.i18nService.t("newCardNudgeTitle");
        this.nudgeBody = this.i18nService.t("newCardNudgeBody");
        break;

      case CipherType.Identity:
        this.dismissalNudgeType = NudgeType.NewIdentityItemStatus;
        this.nudgeTitle = this.i18nService.t("newIdentityNudgeTitle");
        this.nudgeBody = this.i18nService.t("newIdentityNudgeBody");
        break;

      case CipherType.SecureNote:
        this.dismissalNudgeType = NudgeType.NewNoteItemStatus;
        this.nudgeTitle = this.i18nService.t("newNoteNudgeTitle");
        this.nudgeBody = this.i18nService.t("newNoteNudgeBody");
        break;

      case CipherType.SshKey: {
        const sshPartOne = this.i18nService.t("newSshNudgeBodyOne");
        const sshPartTwo = this.i18nService.t("newSshNudgeBodyTwo");

        this.dismissalNudgeType = NudgeType.NewSshItemStatus;
        this.nudgeTitle = this.i18nService.t("newSshNudgeTitle");
        this.nudgeBody = `${sshPartOne} <a href="https://bitwarden.com/help/ssh-agent" class="tw-text-primary-600 tw-font-bold" target="_blank">${sshPartTwo}</a>`;
        break;
      }
      default:
        throw new Error("Unsupported cipher type");
    }
    this.showNewItemSpotlight$ = this.checkHasSpotlightDismissed(
      this.dismissalNudgeType as NudgeType,
      this.activeUserId,
    );
  }

  async dismissNewItemSpotlight() {
    if (this.dismissalNudgeType && this.activeUserId) {
      await this.nudgesService.dismissNudge(this.dismissalNudgeType, this.activeUserId as UserId);
      this.showNewItemSpotlight$ = of(false);
    }
  }

  checkHasSpotlightDismissed(nudgeType: NudgeType, userId: UserId): Observable<boolean> {
    return this.nudgesService
      .showNudgeSpotlight$(nudgeType, userId)
      .pipe(takeUntilDestroyed(this.destroyRef));
  }
}

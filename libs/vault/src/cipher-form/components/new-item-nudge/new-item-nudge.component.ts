import { AsyncPipe } from "@angular/common";
import { Component, input } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, of, switchMap } from "rxjs";

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
  imports: [SpotlightComponent, AsyncPipe],
})
export class NewItemNudgeComponent {
  configType = input.required<CipherType | null>();
  activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  showNewItemSpotlight$ = combineLatest([
    this.activeUserId$,
    toObservable(this.configType).pipe(map((cipherType) => this.mapToNudgeType(cipherType))),
  ]).pipe(
    switchMap(([userId, nudgeType]) => this.nudgesService.showNudgeSpotlight$(nudgeType, userId)),
  );
  nudgeTitle: string = "";
  nudgeBody: string = "";
  dismissalNudgeType: NudgeType | null = null;

  constructor(
    private i18nService: I18nService,
    private accountService: AccountService,
    private nudgesService: NudgesService,
  ) {}

  mapToNudgeType(cipherType: CipherType | null): NudgeType {
    switch (cipherType) {
      case CipherType.Login: {
        const nudgeBodyOne = this.i18nService.t("newLoginNudgeBodyOne");
        const nudgeBodyBold = this.i18nService.t("newLoginNudgeBodyBold");
        const nudgeBodyTwo = this.i18nService.t("newLoginNudgeBodyTwo");
        this.dismissalNudgeType = NudgeType.NewLoginItemStatus;
        this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
        this.nudgeBody = `${nudgeBodyOne} <strong>${nudgeBodyBold}</strong> ${nudgeBodyTwo}`;
        return NudgeType.NewLoginItemStatus;
      }
      case CipherType.Card:
        this.dismissalNudgeType = NudgeType.NewCardItemStatus;
        this.nudgeTitle = this.i18nService.t("newCardNudgeTitle");
        this.nudgeBody = this.i18nService.t("newCardNudgeBody");
        return NudgeType.NewCardItemStatus;

      case CipherType.Identity:
        this.dismissalNudgeType = NudgeType.NewIdentityItemStatus;
        this.nudgeTitle = this.i18nService.t("newIdentityNudgeTitle");
        this.nudgeBody = this.i18nService.t("newIdentityNudgeBody");
        return NudgeType.NewIdentityItemStatus;

      case CipherType.SecureNote:
        this.dismissalNudgeType = NudgeType.NewNoteItemStatus;
        this.nudgeTitle = this.i18nService.t("newNoteNudgeTitle");
        this.nudgeBody = this.i18nService.t("newNoteNudgeBody");
        return NudgeType.NewNoteItemStatus;

      case CipherType.SshKey: {
        const sshPartOne = this.i18nService.t("newSshNudgeBodyOne");
        const sshPartTwo = this.i18nService.t("newSshNudgeBodyTwo");

        this.dismissalNudgeType = NudgeType.NewSshItemStatus;
        this.nudgeTitle = this.i18nService.t("newSshNudgeTitle");
        this.nudgeBody = `${sshPartOne} <a href="https://bitwarden.com/help/ssh-agent" class="tw-text-primary-600 tw-font-bold" target="_blank">${sshPartTwo}</a>`;
        return NudgeType.NewSshItemStatus;
      }
      default:
        throw new Error("Unsupported cipher type");
    }
  }

  async dismissNewItemSpotlight() {
    const activeUserId = await firstValueFrom(this.activeUserId$);
    if (this.dismissalNudgeType && activeUserId) {
      await this.nudgesService.dismissNudge(this.dismissalNudgeType, activeUserId as UserId);
      this.showNewItemSpotlight$ = of(false);
    }
  }
}

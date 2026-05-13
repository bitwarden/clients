import { AsyncPipe } from "@angular/common";
import { Component, input } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, of, switchMap } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CalloutModule } from "@bitwarden/components";
import { CipherType } from "@bitwarden/sdk-internal";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-new-item-nudge",
  templateUrl: "./new-item-nudge.component.html",
  imports: [CalloutModule, AsyncPipe],
})
export class NewItemNudgeComponent {
  readonly configType = input.required<CipherType | null>();
  activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  showNewItemSpotlight$ = combineLatest([this.activeUserId$, toObservable(this.configType)]).pipe(
    switchMap(([userId, cipherType]) => {
      if (cipherType == null) {
        return of(false);
      }
      const nudgeType = this.mapToNudgeType(cipherType);

      if (!nudgeType) {
        return of(false);
      }

      return this.nudgesService.showNudgeSpotlight$(nudgeType, userId);
    }),
  );
  nudgeTitle: string = "";
  nudgeBody: string = "";
  nudgeBodyBold: string = "";
  nudgeBodySuffix: string = "";
  nudgeBodyLinkText: string = "";
  nudgeBodyLinkUrl: string = "";
  dismissalNudgeType: NudgeType | null = null;

  constructor(
    private i18nService: I18nService,
    private accountService: AccountService,
    private nudgesService: NudgesService,
  ) {}

  mapToNudgeType(cipherType: CipherType | null): NudgeType | null {
    this.nudgeBodyBold = "";
    this.nudgeBodySuffix = "";
    this.nudgeBodyLinkText = "";
    this.nudgeBodyLinkUrl = "";
    switch (cipherType) {
      case CipherType.Login: {
        this.dismissalNudgeType = NudgeType.NewLoginItemStatus;
        this.nudgeTitle = this.i18nService.t("newLoginNudgeTitle");
        this.nudgeBody = this.i18nService.t("newLoginNudgeBodyOne");
        this.nudgeBodyBold = this.i18nService.t("newLoginNudgeBodyBold");
        this.nudgeBodySuffix = this.i18nService.t("newLoginNudgeBodyTwo");
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
        this.dismissalNudgeType = NudgeType.NewSshItemStatus;
        this.nudgeTitle = this.i18nService.t("newSshNudgeTitle");
        this.nudgeBody = this.i18nService.t("newSshNudgeBodyOne");
        this.nudgeBodyLinkText = this.i18nService.t("newSshNudgeBodyTwo");
        this.nudgeBodyLinkUrl = "https://bitwarden.com/help/ssh-agent";
        return NudgeType.NewSshItemStatus;
      }
      case CipherType.BankAccount:
        this.dismissalNudgeType = NudgeType.NewBankAccountItemStatus;
        this.nudgeTitle = this.i18nService.t("newBankAccountNudgeTitle");
        this.nudgeBody = this.i18nService.t("newBankAccountNudgeBody");
        return NudgeType.NewBankAccountItemStatus;

      case CipherType.DriversLicense: {
        return null;
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

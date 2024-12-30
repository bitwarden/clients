// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Subject, takeUntil, switchMap } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

@Component({
  selector: "app-action-buttons",
  templateUrl: "action-buttons.component.html",
})
export class ActionButtonsComponent implements OnInit, OnDestroy {
  @Output() onView = new EventEmitter<CipherView>();
  @Output() launchEvent = new EventEmitter<CipherView>();
  @Input() cipher: CipherView;
  @Input() showView = false;

  cipherType = CipherType;
  userHasPremiumAccess = false;

  private componentIsDestroyed$ = new Subject<boolean>();

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private eventCollectionService: EventCollectionService,
    private totpService: TotpServiceAbstraction,
    private passwordRepromptService: PasswordRepromptService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntil(this.componentIsDestroyed$),
      )
      .subscribe((canAccessPremium: boolean) => {
        this.userHasPremiumAccess = canAccessPremium;
      });
  }

  ngOnDestroy() {
    this.componentIsDestroyed$.next(true);
    this.componentIsDestroyed$.complete();
  }

  launchCipher() {
    this.launchEvent.emit(this.cipher);
  }

  async copy(cipher: CipherView, value: string, typeI18nKey: string, aType: string) {
    if (
      this.cipher.reprompt !== CipherRepromptType.None &&
      this.passwordRepromptService.protectedFields().includes(aType) &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    if (value == null || (aType === "TOTP" && !this.displayTotpCopyButton(cipher))) {
      return;
    } else if (aType === "TOTP") {
      value = await this.totpService.getCode(value);
    }

    if (!cipher.viewPassword) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    );

    if (typeI18nKey === "password") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (typeI18nKey === "verificationCodeTotp") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedHiddenField, cipher.id);
    } else if (typeI18nKey === "securityCode") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, cipher.id);
    }
  }

  displayTotpCopyButton(cipher: CipherView) {
    return (
      (cipher?.login?.hasTotp ?? false) && (cipher.organizationUseTotp || this.userHasPremiumAccess)
    );
  }

  view() {
    this.onView.emit(this.cipher);
  }
}

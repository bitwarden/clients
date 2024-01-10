import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

@Component({
  selector: "app-action-buttons",
  templateUrl: "action-buttons.component.html",
})
export class ActionButtonsComponent implements OnInit {
  @Output() onView = new EventEmitter<CipherView>();
  @Output() launchEvent = new EventEmitter<CipherView>();
  @Input() cipher: CipherView;
  @Input() showView = false;

  cipherType = CipherType;
  userHasPremiumAccess = false;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private eventCollectionService: EventCollectionService,
    private totpService: TotpService,
    private stateService: StateService,
    private passwordRepromptService: PasswordRepromptService,
  ) {}

  async ngOnInit() {
    this.userHasPremiumAccess = await this.stateService.getCanAccessPremium();
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
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (typeI18nKey === "verificationCodeTotp") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedHiddenField, cipher.id);
    } else if (typeI18nKey === "securityCode") {
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

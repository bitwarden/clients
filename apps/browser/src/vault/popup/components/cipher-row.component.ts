import { Component, EventEmitter, HostListener, Input, Output } from "@angular/core";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Component({
  selector: "app-cipher-row",
  templateUrl: "cipher-row.component.html",
})
export class CipherRowComponent {
  @Output() onSelected = new EventEmitter<CipherView>();
  @Output() launchEvent = new EventEmitter<CipherView>();
  @Output() onView = new EventEmitter<CipherView>();
  @Input() cipher: CipherView;
  @Input() last: boolean;
  @Input() showView = false;
  @Input() title: string;

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private eventCollectionService: EventCollectionService,
    private totpService: TotpService,
    private passwordRepromptService: PasswordRepromptService
  ) {}

  selectCipher(c: CipherView) {
    this.onSelected.emit(c);
  }

  launchCipher(c: CipherView) {
    this.launchEvent.emit(c);
  }

  viewCipher(c: CipherView) {
    this.onView.emit(c);
  }

  @HostListener("keydown", ["$event"])
  onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      this.selectCipher(this.cipher);
    } else if (event.ctrlKey && event.key === "u") {
      this.copy(this.cipher, this.cipher.login.username, "username", "Username");
    } else if (event.ctrlKey && event.key === "p") {
      this.copy(this.cipher, this.cipher.login.password, "password", "Password");
    } else if (event.ctrlKey && event.key === "t") {
      this.copy(this.cipher, this.cipher.login.totp, "verificationCodeTotp", "TOTP");
    } else if (event.ctrlKey && event.key === "o") {
      this.launchCipher(this.cipher);
    } else {
      return;
    }
    event.preventDefault();
  }

  async copy(cipher: CipherView, value: string, typeI18nKey: string, aType: string) {
    if (
      this.cipher.reprompt !== CipherRepromptType.None &&
      this.passwordRepromptService.protectedFields().includes(aType) &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    if (value == null || aType === "TOTP") {
      value = await this.totpService.getCode(value);
    }

    if (!cipher.viewPassword) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey))
    );

    if (typeI18nKey === "password") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (typeI18nKey === "verificationCodeTotp") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedHiddenField, cipher.id);
    } else if (typeI18nKey === "securityCode") {
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, cipher.id);
    }
  }
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";
import { CopyCipherFieldDirective } from "@bitwarden/vault";

import { VaultPopupCopyButtonsService } from "../../../services/vault-popup-copy-buttons.service";

type CipherItem = {
  value: string;
  key: string;
};

@Component({
  standalone: true,
  selector: "app-item-copy-actions",
  templateUrl: "item-copy-actions.component.html",
  imports: [
    ItemModule,
    IconButtonModule,
    JslibModule,
    MenuModule,
    CommonModule,
    CopyCipherFieldDirective,
  ],
})
export class ItemCopyActionsComponent {
  protected showQuickCopyActions$ = inject(VaultPopupCopyButtonsService).showQuickCopyActions$;

  @Input() cipher: CipherView;

  protected CipherType = CipherType;

  get hasLoginValues() {
    return (
      !!this.cipher.login.hasTotp || !!this.cipher.login.password || !!this.cipher.login.username
    );
  }

  get singleCopiableLogin() {
    const loginItems: CipherItem[] = [
      { value: this.cipher.login.username, key: "username" },
      { value: this.cipher.login.password, key: "password" },
      { value: this.cipher.login.totp, key: "totp" },
    ];
    // If both the password and username are visible but the password is hidden, return the username
    if (!this.cipher.viewPassword && this.cipher.login.username && this.cipher.login.password) {
      return { value: this.cipher.login.username, key: this.i18nService.t("username") };
    }
    return this.findSingleCopiableItem(loginItems);
  }

  get singleCopiableCard() {
    const cardItems: CipherItem[] = [
      { value: this.cipher.card.code, key: "code" },
      { value: this.cipher.card.number, key: "number" },
    ];
    return this.findSingleCopiableItem(cardItems);
  }

  get singleCopiableIdentity() {
    const identityItems: CipherItem[] = [
      { value: this.cipher.identity.fullAddressForCopy, key: "address" },
      { value: this.cipher.identity.email, key: "email" },
      { value: this.cipher.identity.username, key: "username" },
      { value: this.cipher.identity.phone, key: "phone" },
    ];
    return this.findSingleCopiableItem(identityItems);
  }

  /*
   * Given a list of CipherItems, if there is only one item with a value,
   * return it with the translated key. Otherwise return null
   */
  findSingleCopiableItem(items: { value: string; key: string }[]): CipherItem | null {
    const singleItemWithValue = items.find(
      (key) => key.value && items.every((f) => f === key || !f.value),
    );
    return singleItemWithValue
      ? { value: singleItemWithValue.value, key: this.i18nService.t(singleItemWithValue.key) }
      : null;
  }

  get hasCardValues() {
    return !!this.cipher.card.code || !!this.cipher.card.number;
  }

  get hasIdentityValues() {
    return (
      !!this.cipher.identity.fullAddressForCopy ||
      !!this.cipher.identity.email ||
      !!this.cipher.identity.username ||
      !!this.cipher.identity.phone
    );
  }

  get hasSecureNoteValue() {
    return !!this.cipher.notes;
  }

  get hasSshKeyValues() {
    return (
      !!this.cipher.sshKey.privateKey ||
      !!this.cipher.sshKey.publicKey ||
      !!this.cipher.sshKey.keyFingerprint
    );
  }

  constructor(private i18nService: I18nService) {}
}

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";
import { CopyableCipherFields } from "@bitwarden/sdk-internal";

import { CopyFieldAction } from "../../services/copy-cipher-field.service";
import { CopyCipherFieldDirective } from "../copy-cipher-field.directive";

type CipherItem = {
  /** Translation key for the respective value */
  key: string;
  /** Property key on `CipherView` to retrieve the copy value */
  field: CopyFieldAction;
};
@Component({
  selector: "vault-item-copy-actions",
  templateUrl: "./item-copy-actions.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ItemModule, IconButtonModule, JslibModule, MenuModule, CopyCipherFieldDirective],
})
export class VaultItemCopyActionsComponent {
  readonly cipher = input.required<CipherViewLike>();

  readonly showQuickCopyActions = input(false);

  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;
  protected readonly CipherType = CipherType;

  constructor(private readonly i18nService: I18nService) {}

  /*
   * singleCopyableLogin uses appCopyField instead of appCopyClick. This allows for the TOTP
   * code to be copied correctly. See #14167
   */
  get singleCopyableLogin(): CipherItem | null {
    const cipher = this.cipher();
    const loginItems = this.getLoginCopyableItems(cipher);

    return this.findSingleCopyableItem(cipher, loginItems);
  }

  private getLoginCopyableItems(cipher: CipherViewLike): CipherItem[] {
    const loginItems: CipherItem[] = [
      { key: "username", field: "username" },
      { key: "password", field: "password" },
      { key: "verificationCodeTotp", field: "totp" },
    ];

    return cipher.viewPassword
      ? loginItems
      : loginItems.filter((item) => item.field !== "password");
  }

  get singleCopyableCard() {
    const cardItems: CipherItem[] = [
      { key: "securityCode", field: "securityCode" },
      { key: "cardNumber", field: "cardNumber" },
    ];
    return this.findSingleCopyableItem(this.cipher(), cardItems);
  }

  get singleCopyableIdentity() {
    const identityItems: CipherItem[] = [
      { key: "address", field: "address" },
      { key: "email", field: "email" },
      { key: "username", field: "username" },
      { key: "phone", field: "phone" },
    ];
    return this.findSingleCopyableItem(this.cipher(), identityItems);
  }

  /*
   * Given a list of CipherItems, if there is only one item with a value,
   * return it with the translated key. Otherwise return null.
   */
  findSingleCopyableItem(cipher: CipherViewLike, items: CipherItem[]): CipherItem | null {
    const itemsWithValue = items.filter(({ field }) =>
      CipherViewLikeUtils.hasCopyableValue(cipher, field),
    );

    return itemsWithValue.length === 1
      ? { ...itemsWithValue[0], key: this.i18nService.t(itemsWithValue[0].key) }
      : null;
  }

  get hasLoginValues() {
    return this.getNumberOfLoginValues(this.cipher()) > 0;
  }

  get hasCardValues() {
    return this.getNumberOfCardValues(this.cipher()) > 0;
  }

  get hasIdentityValues() {
    return this.getNumberOfIdentityValues(this.cipher()) > 0;
  }

  get hasSecureNoteValue() {
    return this.getNumberOfSecureNoteValues(this.cipher()) > 0;
  }

  get hasSshKeyValues() {
    return this.getNumberOfSshKeyValues(this.cipher()) > 0;
  }

  /** Sets the number of populated login values for the cipher */
  private getNumberOfLoginValues(cipher: CipherViewLike) {
    return this.getLoginCopyableItems(cipher)
      .map((item) => CipherViewLikeUtils.hasCopyableValue(cipher, item.field))
      .filter(Boolean).length;
  }

  /** Sets the number of populated card values for the cipher */
  private getNumberOfCardValues(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      const copyableCardFields: CopyableCipherFields[] = ["CardSecurityCode", "CardNumber"];

      return cipher.copyableFields.filter((field) => copyableCardFields.includes(field)).length;
    }

    return [cipher.card.code, cipher.card.number].filter(Boolean).length;
  }

  /** Sets the number of populated identity values for the cipher */
  private getNumberOfIdentityValues(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      const copyableIdentityFields: CopyableCipherFields[] = [
        "IdentityAddress",
        "IdentityEmail",
        "IdentityUsername",
        "IdentityPhone",
      ];

      return cipher.copyableFields.filter((field) => copyableIdentityFields.includes(field)).length;
    }

    return [
      cipher.identity.fullAddressForCopy,
      cipher.identity.email,
      cipher.identity.username,
      cipher.identity.phone,
    ].filter(Boolean).length;
  }

  /** Sets the number of populated secure note values for the cipher */
  private getNumberOfSecureNoteValues(cipher: CipherViewLike): number {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      return cipher.copyableFields.includes("SecureNotes") ? 1 : 0;
    }

    return cipher.notes ? 1 : 0;
  }

  /** Sets the number of populated SSH key values for the cipher */
  private getNumberOfSshKeyValues(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      return cipher.copyableFields.includes("SshKey") ? 1 : 0;
    }

    return [cipher.sshKey.privateKey, cipher.sshKey.publicKey, cipher.sshKey.keyFingerprint].filter(
      Boolean,
    ).length;
  }
}

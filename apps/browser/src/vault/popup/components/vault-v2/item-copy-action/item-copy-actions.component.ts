import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";
import { CopyableCipherFields } from "@bitwarden/sdk-internal";
import { CopyFieldAction, CopyCipherFieldDirective } from "@bitwarden/vault";

import { VaultPopupCopyButtonsService } from "../../../services/vault-popup-copy-buttons.service";

type CipherItem = {
  /** Translation key for the respective value */
  key: string;
  /** Property key on `CipherView` to retrieve the copy value */
  field: CopyFieldAction;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) cipher!: CipherViewLike;

  protected CipherViewLikeUtils = CipherViewLikeUtils;
  protected CipherType = CipherType;

  /*
   * singleCopyableLogin uses appCopyField instead of appCopyClick. This allows for the TOTP
   * code to be copied correctly. See #14167
   */
  get singleCopyableLogin(): CipherItem | null {
    const loginItems: CipherItem[] = [
      { key: "copyUsername", field: "username" },
      { key: "copyPassword", field: "password" },
      { key: "copyVerificationCode", field: "totp" },
    ];
    // If both the password and username are visible but the password is hidden, return the username
    if (
      !this.cipher.viewPassword &&
      CipherViewLikeUtils.hasCopyableValue(this.cipher, "username") &&
      CipherViewLikeUtils.hasCopyableValue(this.cipher, "password")
    ) {
      return {
        key: this.i18nService.t("copyUsername"),
        field: "username" as const,
      };
    }
    return this.findSingleCopyableItem(loginItems);
  }

  get singleCopyableCard() {
    const cardItems: CipherItem[] = [
      { key: "securityCode", field: "securityCode" },
      { key: "cardNumber", field: "cardNumber" },
    ];
    return this.findSingleCopyableItem(cardItems);
  }

  get singleCopyableIdentity() {
    const identityItems: CipherItem[] = [
      { key: "address", field: "address" },
      { key: "email", field: "email" },
      { key: "username", field: "username" },
      { key: "phone", field: "phone" },
    ];
    return this.findSingleCopyableItem(identityItems);
  }

  /*
   * Given a list of CipherItems, if there is only one item with a value,
   * return it with the translated key. Otherwise return null
   */
  findSingleCopyableItem(items: CipherItem[]): CipherItem | null {
    const itemsWithValue = items.filter(({ field }) =>
      CipherViewLikeUtils.hasCopyableValue(this.cipher, field),
    );
    return itemsWithValue.length === 1
      ? { ...itemsWithValue[0], key: this.i18nService.t(itemsWithValue[0].key) }
      : null;
  }

  get hasLoginValues() {
    return this.getNumberOfLoginValues() > 0;
  }

  get hasCardValues() {
    return this.getNumberOfCardValues() > 0;
  }

  get hasIdentityValues() {
    return this.getNumberOfIdentityValues() > 0;
  }

  get hasSecureNoteValue() {
    return this.getNumberOfSecureNoteValues() > 0;
  }

  get hasSshKeyValues() {
    return this.getNumberOfSshKeyValues() > 0;
  }

  constructor(private i18nService: I18nService) {}

  /** Sets the number of populated login values for the cipher */
  private getNumberOfLoginValues() {
    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      const copyableLoginFields: CopyableCipherFields[] = [
        "LoginUsername",
        "LoginPassword",
        "LoginTotp",
      ];
      return this.cipher.copyableFields.filter((field) => copyableLoginFields.includes(field))
        .length;
    }

    return [this.cipher.login.username, this.cipher.login.password, this.cipher.login.totp].filter(
      Boolean,
    ).length;
  }

  /** Sets the number of populated card values for the cipher */
  private getNumberOfCardValues() {
    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      const copyableCardFields: CopyableCipherFields[] = ["CardSecurityCode", "CardNumber"];
      return this.cipher.copyableFields.filter((field) => copyableCardFields.includes(field))
        .length;
    }

    return [this.cipher.card.code, this.cipher.card.number].filter(Boolean).length;
  }

  /** Sets the number of populated identity values for the cipher */
  private getNumberOfIdentityValues() {
    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      const copyableIdentityFields: CopyableCipherFields[] = [
        "IdentityAddress",
        "IdentityEmail",
        "IdentityUsername",
        "IdentityPhone",
      ];
      return this.cipher.copyableFields.filter((field) => copyableIdentityFields.includes(field))
        .length;
    }

    return [
      this.cipher.identity.fullAddressForCopy,
      this.cipher.identity.email,
      this.cipher.identity.username,
      this.cipher.identity.phone,
    ].filter(Boolean).length;
  }
  /** Sets the number of populated secure note values for the cipher */
  private getNumberOfSecureNoteValues(): number {
    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      return this.cipher.copyableFields.includes("SecureNotes") ? 1 : 0;
    }

    return this.cipher.notes ? 1 : 0;
  }

  /** Sets the number of populated SSH key values for the cipher */
  private getNumberOfSshKeyValues() {
    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      return this.cipher.copyableFields.includes("SshKey") ? 1 : 0;
    }

    return [
      this.cipher.sshKey.privateKey,
      this.cipher.sshKey.publicKey,
      this.cipher.sshKey.keyFingerprint,
    ].filter(Boolean).length;
  }
}

import { CommonModule } from "@angular/common";
import { Component, Input, OnInit, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";
import { CopiableCipherFields } from "@bitwarden/sdk-internal";
import { CopyAction, CopyCipherFieldDirective } from "@bitwarden/vault";

import { VaultPopupCopyButtonsService } from "../../../services/vault-popup-copy-buttons.service";

type CipherItem = {
  /** Translation key for the respective value */
  key: string;
  /** Property key on `CipherView` to retrieve the copy value */
  field: CopyAction;
};

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
export class ItemCopyActionsComponent implements OnInit {
  protected showQuickCopyActions$ = inject(VaultPopupCopyButtonsService).showQuickCopyActions$;
  @Input({ required: true }) cipher!: CipherViewLike;

  protected CipherViewLikeUtils = CipherViewLikeUtils;
  protected CipherType = CipherType;

  protected numberOfLoginValues = 0;
  protected numberOfCardValues = 0;
  protected numberOfIdentityValues = 0;
  protected numberOfSecureNoteValues = 0;
  protected numberOfSshKeyValues = 0;

  /*
   * singleCopiableLogin uses appCopyField instead of appCopyClick. This allows for the TOTP
   * code to be copied correctly. See #14167
   */
  get singleCopiableLogin() {
    const loginItems: CipherItem[] = [
      { key: "copyUsername", field: "username" },
      { key: "copyPassword", field: "password" },
      { key: "copyVerificationCode", field: "totp" },
    ];
    // If both the password and username are visible but the password is hidden, return the username
    if (
      !this.cipher.viewPassword &&
      CipherViewLikeUtils.hasCopiableValue(this.cipher, "username") &&
      CipherViewLikeUtils.hasCopiableValue(this.cipher, "password")
    ) {
      return {
        key: this.i18nService.t("copyUsername"),
        field: "username",
      };
    }
    return this.findSingleCopiableItem(loginItems);
  }

  get singleCopiableCard() {
    const cardItems: CipherItem[] = [
      { key: "code", field: "securityCode" },
      { key: "number", field: "cardNumber" },
    ];
    return this.findSingleCopiableItem(cardItems);
  }

  get singleCopiableIdentity() {
    const identityItems: CipherItem[] = [
      { key: "address", field: "address" },
      { key: "email", field: "email" },
      { key: "username", field: "username" },
      { key: "phone", field: "phone" },
    ];
    return this.findSingleCopiableItem(identityItems);
  }

  /*
   * Given a list of CipherItems, if there is only one item with a value,
   * return it with the translated key. Otherwise return null
   */
  findSingleCopiableItem(items: CipherItem[]): CipherItem | null {
    const itemsWithValue = items.filter(({ field }) =>
      CipherViewLikeUtils.hasCopiableValue(this.cipher, field),
    );
    return itemsWithValue.length === 1
      ? { ...itemsWithValue[0], key: this.i18nService.t(itemsWithValue[0].key) }
      : null;
  }

  get hasLoginValues() {
    return this.numberOfLoginValues > 0;
  }

  get hasCardValues() {
    return this.numberOfCardValues > 0;
  }

  get hasIdentityValues() {
    return this.numberOfIdentityValues > 0;
  }

  get hasSecureNoteValue() {
    return this.numberOfSecureNoteValues > 0;
  }

  get hasSshKeyValues() {
    return this.numberOfSshKeyValues > 0;
  }

  constructor(private i18nService: I18nService) {}

  ngOnInit(): void {
    this.setNumberOfLoginValues();
    this.setNumberOfCardValues();
    this.setNumberOfIdentityValues();
    this.setNumberOfSecureNoteValues();
    this.setNumberOfSshKeyValues();
  }

  /** Sets the number of populated login values for the cipher */
  private setNumberOfLoginValues() {
    if (CipherViewLikeUtils.getType(this.cipher) !== CipherType.Login) {
      return;
    }

    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      const copiableLoginFields: CopiableCipherFields[] = [
        "LoginUsername",
        "LoginPassword",
        "LoginTotp",
      ];

      this.numberOfLoginValues = this.cipher.copiableFields.filter((field) =>
        copiableLoginFields.includes(field),
      ).length;
      return;
    }

    this.numberOfLoginValues = [
      this.cipher.login.username,
      this.cipher.login.password,
      this.cipher.login.totp,
    ].filter(Boolean).length;
  }

  /** Sets the number of populated card values for the cipher */
  private setNumberOfCardValues() {
    if (CipherViewLikeUtils.getType(this.cipher) !== CipherType.Card) {
      return;
    }

    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      const copiableCardFields: CopiableCipherFields[] = ["CardSecurityCode", "CardNumber"];
      this.numberOfCardValues = this.cipher.copiableFields.filter((field) =>
        copiableCardFields.includes(field),
      ).length;
      return;
    }

    this.numberOfCardValues = [this.cipher.card.code, this.cipher.card.number].filter(
      Boolean,
    ).length;
  }

  /** Sets the number of populated identity values for the cipher */
  private setNumberOfIdentityValues() {
    if (CipherViewLikeUtils.getType(this.cipher) !== CipherType.Identity) {
      return;
    }

    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      const copiableIdentityFields: CopiableCipherFields[] = [
        "IdentityAddress",
        "IdentityEmail",
        "IdentityUsername",
        "IdentityPhone",
      ];
      this.numberOfIdentityValues = this.cipher.copiableFields.filter((field) =>
        copiableIdentityFields.includes(field),
      ).length;
      return;
    }

    this.numberOfIdentityValues = [
      this.cipher.identity.fullAddressForCopy,
      this.cipher.identity.email,
      this.cipher.identity.username,
      this.cipher.identity.phone,
    ].filter(Boolean).length;
  }
  /** Sets the number of populated secure note values for the cipher */
  private setNumberOfSecureNoteValues() {
    if (CipherViewLikeUtils.getType(this.cipher) !== CipherType.SecureNote) {
      return;
    }

    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      this.numberOfSecureNoteValues = this.cipher.copiableFields.includes("SecureNotes") ? 1 : 0;
      return;
    }

    this.numberOfSecureNoteValues = this.cipher.notes ? 1 : 0;
  }

  /** Sets the number of populated SSH key values for the cipher */
  private setNumberOfSshKeyValues() {
    if (CipherViewLikeUtils.getType(this.cipher) !== CipherType.SshKey) {
      this.numberOfSshKeyValues = 0;
      return;
    }

    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      this.numberOfSshKeyValues = this.cipher.copiableFields.includes("SshKey") ? 1 : 0;
      return;
    }

    this.numberOfSshKeyValues = [
      this.cipher.sshKey.privateKey,
      this.cipher.sshKey.publicKey,
      this.cipher.sshKey.keyFingerprint,
    ].filter(Boolean).length;
  }
}

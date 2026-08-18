import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";

import { CopyFieldAction } from "../../services/copy-cipher-field.service";
import { CopyCipherFieldDirective } from "../copy-cipher-field.directive";

type CipherItem = {
  /** Translation key for the respective value */
  key: string;
  /** Property key on `CipherView` to retrieve the copy value */
  field: CopyFieldAction;
};

const CARD_ITEMS: CipherItem[] = [
  { key: "securityCode", field: "securityCode" },
  { key: "cardNumber", field: "cardNumber" },
];

const IDENTITY_ITEMS: CipherItem[] = [
  { key: "address", field: "address" },
  { key: "email", field: "email" },
  { key: "username", field: "username" },
  { key: "phone", field: "phone" },
];

const BANK_ACCOUNT_ITEMS: CipherItem[] = [
  { key: "nameOnAccount", field: "nameOnAccount" },
  { key: "accountNumber", field: "accountNumber" },
  { key: "bankRoutingNumber", field: "routingNumber" },
  { key: "branchNumber", field: "branchNumber" },
  { key: "pin", field: "pin" },
  { key: "iban", field: "iban" },
  { key: "swiftCode", field: "swiftCode" },
];

const DRIVERS_LICENSE_ITEMS: CipherItem[] = [
  { key: "firstName", field: "firstNameLicense" },
  { key: "middleName", field: "middleNameLicense" },
  { key: "lastName", field: "lastNameLicense" },
  { key: "licenseNumber", field: "licenseNumber" },
];

const PASSPORT_ITEMS: CipherItem[] = [
  { key: "firstName", field: "givenName" },
  { key: "lastName", field: "surname" },
  { key: "passportNumber", field: "passportNumber" },
  { key: "nationalIdentificationNumber", field: "nationalIdentificationNumber" },
];

/** SSH keys and secure notes have no single-field copy action, so only the fields are needed. */
const SSH_KEY_FIELDS: CopyFieldAction[] = ["privateKey", "publicKey", "keyFingerprint"];
const SECURE_NOTE_FIELDS: CopyFieldAction[] = ["secureNote"];

@Component({
  selector: "vault-item-copy-actions",
  templateUrl: "./item-copy-actions.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ItemModule, IconButtonModule, JslibModule, MenuModule, CopyCipherFieldDirective],
  host: {
    /**
     * Space the copy actions consistently regardless of the consumer. Matches the spacing
     * `bit-item` applies to its end slot, so the actions look the same in list contexts
     * (browser popup) and outside of them (web vault table rows).
     */
    class: "tw-flex tw-items-center tw-gap-2 [&_button[biticonbutton]]:-tw-mx-1",
  },
})
export class VaultItemCopyActionsComponent {
  readonly cipher = input.required<CipherViewLike>();

  readonly showQuickCopyActions = input(false);

  /** Disables all copy actions, e.g. while the containing list is refreshing. */
  readonly disabled = input(false);

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
    return this.findSingleCopyableItem(this.cipher(), CARD_ITEMS);
  }

  get singleCopyableIdentity() {
    return this.findSingleCopyableItem(this.cipher(), IDENTITY_ITEMS);
  }

  get singleCopyableBankAccount() {
    return this.findSingleCopyableItem(this.cipher(), BANK_ACCOUNT_ITEMS);
  }

  get singleCopyableDriversLicense() {
    return this.findSingleCopyableItem(this.cipher(), DRIVERS_LICENSE_ITEMS);
  }

  get singleCopyablePassport(): CipherItem | null {
    return this.findSingleCopyableItem(this.cipher(), PASSPORT_ITEMS);
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
    return this.hasCopyableValues(this.getLoginCopyableItems(this.cipher()).map((i) => i.field));
  }

  get hasCardValues() {
    return this.hasCopyableValues(CARD_ITEMS.map((i) => i.field));
  }

  get hasIdentityValues() {
    return this.hasCopyableValues(IDENTITY_ITEMS.map((i) => i.field));
  }

  get hasSecureNoteValue() {
    return this.hasCopyableValues(SECURE_NOTE_FIELDS);
  }

  get hasSshKeyValues() {
    return this.hasCopyableValues(SSH_KEY_FIELDS);
  }

  get hasBankAccountValues() {
    return this.hasCopyableValues(BANK_ACCOUNT_ITEMS.map((i) => i.field));
  }

  get hasDriversLicenseValues() {
    return this.hasCopyableValues(DRIVERS_LICENSE_ITEMS.map((i) => i.field));
  }

  get hasPassportValues() {
    return this.hasCopyableValues(PASSPORT_ITEMS.map((i) => i.field));
  }

  /**
   * @returns `true` when at least one of the given fields is populated.
   *
   * Every type resolves availability through `CipherViewLikeUtils.hasCopyableValue` so that the
   * menu trigger can never be enabled while all of the actions inside it are unavailable.
   */
  private hasCopyableValues(fields: CopyFieldAction[]): boolean {
    const cipher = this.cipher();

    return fields.some((field) => CipherViewLikeUtils.hasCopyableValue(cipher, field));
  }
}

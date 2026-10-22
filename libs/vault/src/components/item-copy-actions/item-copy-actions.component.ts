import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
  /**
   * Translation key for the full copy action label, e.g. `copyUsername` -> "Copy username".
   * Full phrases are used rather than composing "Copy" with a field name so translators
   * receive a complete sentence to localize.
   */
  key: string;
  /** Property key on `CipherView` to retrieve the copy value */
  field: CopyFieldAction;
};
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
      { key: "copyUsername", field: "username" },
      { key: "copyPassword", field: "password" },
      { key: "copyVerificationCode", field: "totp" },
    ];

    return cipher.viewPassword
      ? loginItems
      : loginItems.filter((item) => item.field !== "password");
  }

  get singleCopyableCard() {
    const cardItems: CipherItem[] = [
      { key: "copySecurityCode", field: "securityCode" },
      { key: "copyNumber", field: "cardNumber" },
    ];
    return this.findSingleCopyableItem(this.cipher(), cardItems);
  }

  get singleCopyableIdentity() {
    const identityItems: CipherItem[] = [
      { key: "copyAddress", field: "address" },
      { key: "copyEmail", field: "email" },
      { key: "copyUsername", field: "username" },
      { key: "copyPhone", field: "phone" },
    ];
    return this.findSingleCopyableItem(this.cipher(), identityItems);
  }

  get singleCopyableBankAccount() {
    const bankAccountItems: CipherItem[] = [
      { key: "copyNameOnAccount", field: "nameOnAccount" },
      { key: "copyAccountNumber", field: "accountNumber" },
      { key: "copyRoutingNumber", field: "routingNumber" },
      { key: "copyBranchNumber", field: "branchNumber" },
      { key: "copyPin", field: "pin" },
      { key: "copyIban", field: "iban" },
      { key: "copySwiftCode", field: "swiftCode" },
    ];
    return this.findSingleCopyableItem(this.cipher(), bankAccountItems);
  }

  get singleCopyableDriversLicense() {
    const driversLicenseItems: CipherItem[] = [
      { key: "copyFirstName", field: "firstNameLicense" },
      { key: "copyMiddleName", field: "middleNameLicense" },
      { key: "copyLastName", field: "lastNameLicense" },
      { key: "copyLicenseNumber", field: "licenseNumber" },
    ];
    return this.findSingleCopyableItem(this.cipher(), driversLicenseItems);
  }

  get singleCopyablePassport(): CipherItem | null {
    const passportItems: CipherItem[] = [
      { key: "copyFirstName", field: "givenName" },
      { key: "copyLastName", field: "surname" },
      { key: "copyPassportNumber", field: "passportNumber" },
      { key: "copyNationalIdentificationNumber", field: "nationalIdentificationNumber" },
    ];
    return this.findSingleCopyableItem(this.cipher(), passportItems);
  }

  /*
   * Given a list of CipherItems, if there is only one item with a value,
   * return it. Otherwise return null. The template translates `key` via the i18n pipe.
   */
  findSingleCopyableItem(cipher: CipherViewLike, items: CipherItem[]): CipherItem | null {
    const itemsWithValue = items.filter(({ field }) =>
      CipherViewLikeUtils.hasCopyableValue(cipher, field),
    );

    return itemsWithValue.length === 1 ? itemsWithValue[0] : null;
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

  get hasBankAccountValues() {
    return this.getNumberOfBankAccountValues(this.cipher()) > 0;
  }

  get hasDriversLicenseValues() {
    return this.getNumberOfDriversLicenseValues(this.cipher()) > 0;
  }

  get hasPassportValues() {
    return this.getNumberOfPassportValues(this.cipher()) > 0;
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

  /** Sets the number of populated passport values for the cipher */
  private getNumberOfPassportValues(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      const copyablePassportFields: CopyableCipherFields[] = [
        "PassportGivenName",
        "PassportSurname",
        "PassportPassportNumber",
        "PassportNationalIdentificationNumber",
      ];
      return cipher.copyableFields.filter((field) => copyablePassportFields.includes(field)).length;
    }
    return [
      cipher.passport?.givenName,
      cipher.passport?.surname,
      cipher.passport?.passportNumber,
      cipher.passport?.nationalIdentificationNumber,
    ].filter(Boolean).length;
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

  /** Sets the number of populated bank account values for the cipher */
  private getNumberOfBankAccountValues(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      const copyableBankAccountFields: CopyableCipherFields[] = [
        "BankAccountNameOnAccount",
        "BankAccountAccountNumber",
        "BankAccountRoutingNumber",
        "BankAccountBranchNumber",
        "BankAccountPin",
        "BankAccountIban",
        "BankAccountSwift",
      ];

      return cipher.copyableFields.filter((field) => copyableBankAccountFields.includes(field))
        .length;
    }

    return [
      cipher.bankAccount.nameOnAccount,
      cipher.bankAccount.accountNumber,
      cipher.bankAccount.routingNumber,
      cipher.bankAccount.branchNumber,
      cipher.bankAccount.pin,
      cipher.bankAccount.iban,
      cipher.bankAccount.swiftCode,
    ].filter(Boolean).length;
  }

  /** Sets the number of populated drivers license values for the cipher */
  private getNumberOfDriversLicenseValues(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.isCipherListView(cipher)) {
      const copyableDriversLicenseFields: CopyableCipherFields[] = [
        "DriversLicenseFirstName",
        "DriversLicenseMiddleName",
        "DriversLicenseLastName",
        "DriversLicenseLicenseNumber",
      ];

      return cipher.copyableFields.filter((field) => copyableDriversLicenseFields.includes(field))
        .length;
    }

    return [
      cipher.driversLicense?.firstName,
      cipher.driversLicense?.middleName,
      cipher.driversLicense?.lastName,
      cipher.driversLicense?.licenseNumber,
    ].filter(Boolean).length;
  }
}

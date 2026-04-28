import { Jsonify } from "type-fest";

import { BankAccount as SdkBankAccount } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { BankAccountData } from "../data/bank-account.data";
import { BankAccountView } from "../view/bank-account.view";

export class BankAccount extends Domain {
  bankName?: EncString;
  nameOnAccount?: EncString;
  accountType?: EncString;
  accountNumber?: EncString;
  routingNumber?: EncString;
  branchNumber?: EncString;
  pin?: EncString;
  swiftCode?: EncString;
  iban?: EncString;
  bankContactPhone?: EncString;

  constructor(obj?: BankAccountData) {
    super();
    if (obj == null) {
      return;
    }

    this.bankName = conditionalEncString(obj.bankName);
    this.nameOnAccount = conditionalEncString(obj.nameOnAccount);
    this.accountType = conditionalEncString(obj.accountType);
    this.accountNumber = conditionalEncString(obj.accountNumber);
    this.routingNumber = conditionalEncString(obj.routingNumber);
    this.branchNumber = conditionalEncString(obj.branchNumber);
    this.pin = conditionalEncString(obj.pin);
    this.swiftCode = conditionalEncString(obj.swiftCode);
    this.iban = conditionalEncString(obj.iban);
    this.bankContactPhone = conditionalEncString(obj.bankContactPhone);
  }

  decrypt(encKey: SymmetricCryptoKey, context = "No Cipher Context"): Promise<BankAccountView> {
    return this.decryptObj<BankAccount, BankAccountView>(
      this,
      new BankAccountView(),
      [
        "bankName",
        "nameOnAccount",
        "accountType",
        "accountNumber",
        "routingNumber",
        "branchNumber",
        "pin",
        "swiftCode",
        "iban",
        "bankContactPhone",
      ],
      encKey,
      "DomainType: BankAccount; " + context,
    );
  }

  toBankAccountData(): BankAccountData {
    const c = new BankAccountData();
    this.buildDataModel(this, c, {
      bankName: null,
      nameOnAccount: null,
      accountType: null,
      accountNumber: null,
      routingNumber: null,
      branchNumber: null,
      pin: null,
      swiftCode: null,
      iban: null,
      bankContactPhone: null,
    });
    return c;
  }

  static fromJSON(obj: Jsonify<BankAccount> | undefined): BankAccount | undefined {
    if (obj == null) {
      return undefined;
    }

    const bankAccount = new BankAccount();
    bankAccount.bankName = encStringFrom(obj.bankName);
    bankAccount.nameOnAccount = encStringFrom(obj.nameOnAccount);
    bankAccount.accountType = encStringFrom(obj.accountType);
    bankAccount.accountNumber = encStringFrom(obj.accountNumber);
    bankAccount.routingNumber = encStringFrom(obj.routingNumber);
    bankAccount.branchNumber = encStringFrom(obj.branchNumber);
    bankAccount.pin = encStringFrom(obj.pin);
    bankAccount.swiftCode = encStringFrom(obj.swiftCode);
    bankAccount.iban = encStringFrom(obj.iban);
    bankAccount.bankContactPhone = encStringFrom(obj.bankContactPhone);

    return bankAccount;
  }

  /**
   * Maps BankAccount to SDK format.
   */
  toSdkBankAccount(): SdkBankAccount {
    return {
      bankName: this.bankName?.toSdk(),
      nameOnAccount: this.nameOnAccount?.toSdk(),
      accountType: this.accountType?.toSdk(),
      accountNumber: this.accountNumber?.toSdk(),
      routingNumber: this.routingNumber?.toSdk(),
      branchNumber: this.branchNumber?.toSdk(),
      pin: this.pin?.toSdk(),
      swiftCode: this.swiftCode?.toSdk(),
      iban: this.iban?.toSdk(),
      bankContactPhone: this.bankContactPhone?.toSdk(),
    };
  }

  /**
   * Maps an SDK BankAccount object to a BankAccount.
   */
  static fromSdkBankAccount(obj?: SdkBankAccount): BankAccount | undefined {
    if (!obj) {
      return undefined;
    }

    const bankAccount = new BankAccount();
    bankAccount.bankName = encStringFrom(obj.bankName);
    bankAccount.nameOnAccount = encStringFrom(obj.nameOnAccount);
    bankAccount.accountType = encStringFrom(obj.accountType);
    bankAccount.accountNumber = encStringFrom(obj.accountNumber);
    bankAccount.routingNumber = encStringFrom(obj.routingNumber);
    bankAccount.branchNumber = encStringFrom(obj.branchNumber);
    bankAccount.pin = encStringFrom(obj.pin);
    bankAccount.swiftCode = encStringFrom(obj.swiftCode);
    bankAccount.iban = encStringFrom(obj.iban);
    bankAccount.bankContactPhone = encStringFrom(obj.bankContactPhone);

    return bankAccount;
  }
}

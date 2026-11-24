import { Jsonify } from "type-fest";

import { BankAccount as SdkBankAccount, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { BankAccountData } from "../data/bank-account.data";

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

    this.bankName = (obj.bankName ?? undefined) as EncString;
    this.nameOnAccount = (obj.nameOnAccount ?? undefined) as EncString;
    this.accountType = (obj.accountType ?? undefined) as EncString;
    this.accountNumber = (obj.accountNumber ?? undefined) as EncString;
    this.routingNumber = (obj.routingNumber ?? undefined) as EncString;
    this.branchNumber = (obj.branchNumber ?? undefined) as EncString;
    this.pin = (obj.pin ?? undefined) as EncString;
    this.swiftCode = (obj.swiftCode ?? undefined) as EncString;
    this.iban = (obj.iban ?? undefined) as EncString;
    this.bankContactPhone = (obj.bankContactPhone ?? undefined) as EncString;
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
    bankAccount.bankName = obj.bankName ?? undefined;
    bankAccount.nameOnAccount = obj.nameOnAccount ?? undefined;
    bankAccount.accountType = obj.accountType ?? undefined;
    bankAccount.accountNumber = obj.accountNumber ?? undefined;
    bankAccount.routingNumber = obj.routingNumber ?? undefined;
    bankAccount.branchNumber = obj.branchNumber ?? undefined;
    bankAccount.pin = obj.pin ?? undefined;
    bankAccount.swiftCode = obj.swiftCode ?? undefined;
    bankAccount.iban = obj.iban ?? undefined;
    bankAccount.bankContactPhone = obj.bankContactPhone ?? undefined;

    return bankAccount;
  }

  /**
   * Maps BankAccount to SDK format.
   */
  toSdkBankAccount(): SdkBankAccount {
    return {
      bankName: this.bankName ?? undefined,
      nameOnAccount: this.nameOnAccount ?? undefined,
      accountType: this.accountType ?? undefined,
      accountNumber: this.accountNumber ?? undefined,
      routingNumber: this.routingNumber ?? undefined,
      branchNumber: this.branchNumber ?? undefined,
      pin: this.pin ?? undefined,
      swiftCode: this.swiftCode ?? undefined,
      iban: this.iban ?? undefined,
      bankContactPhone: this.bankContactPhone ?? undefined,
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
    bankAccount.bankName = obj.bankName ?? undefined;
    bankAccount.nameOnAccount = obj.nameOnAccount ?? undefined;
    bankAccount.accountType = obj.accountType ?? undefined;
    bankAccount.accountNumber = obj.accountNumber ?? undefined;
    bankAccount.routingNumber = obj.routingNumber ?? undefined;
    bankAccount.branchNumber = obj.branchNumber ?? undefined;
    bankAccount.pin = obj.pin ?? undefined;
    bankAccount.swiftCode = obj.swiftCode ?? undefined;
    bankAccount.iban = obj.iban ?? undefined;
    bankAccount.bankContactPhone = obj.bankContactPhone ?? undefined;

    return bankAccount;
  }
}

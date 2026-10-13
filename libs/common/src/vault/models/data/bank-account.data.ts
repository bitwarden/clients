import { BankAccountApi } from "../api/bank-account.api";

export class BankAccountData {
  bankName?: string;
  nameOnAccount?: string;
  accountType?: string;
  accountNumber?: string;
  routingNumber?: string;
  branchNumber?: string;
  pin?: string;
  swiftCode?: string;
  iban?: string;
  bankContactPhone?: string;

  constructor(data?: BankAccountApi) {
    if (data == null) {
      return;
    }

    this.bankName = data.bankName;
    this.nameOnAccount = data.nameOnAccount;
    this.accountType = data.accountType;
    this.accountNumber = data.accountNumber;
    this.routingNumber = data.routingNumber;
    this.branchNumber = data.branchNumber;
    this.pin = data.pin;
    this.swiftCode = data.swiftCode;
    this.iban = data.iban;
    this.bankContactPhone = data.bankContactPhone;
  }
}

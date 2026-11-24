import { EncString } from "@bitwarden/sdk-internal";

import { BankAccount as BankAccountDomain } from "../../vault/models/domain/bank-account";
import { BankAccountView } from "../../vault/models/view/bank-account.view";

export class BankAccountExport {
  static template(): BankAccountExport {
    const req = new BankAccountExport();
    req.bankName = "Acme Bank";
    req.nameOnAccount = "John Doe";
    req.accountType = "checking";
    req.accountNumber = "000123456789";
    req.routingNumber = "000000000";
    req.branchNumber = "000";
    req.pin = "1234";
    req.swiftCode = "ACMEUS33";
    req.iban = "GB00ACME12345600000001";
    req.bankContactPhone = "1-800-123-4567";
    return req;
  }

  static toView(
    req?: BankAccountExport,
    view = new BankAccountView(),
  ): BankAccountView | undefined {
    if (req == null) {
      return undefined;
    }

    view.bankName = req.bankName;
    view.nameOnAccount = req.nameOnAccount;
    view.accountType = req.accountType;
    view.accountNumber = req.accountNumber;
    view.routingNumber = req.routingNumber;
    view.branchNumber = req.branchNumber;
    view.pin = req.pin;
    view.swiftCode = req.swiftCode;
    view.iban = req.iban;
    view.bankContactPhone = req.bankContactPhone;
    return view;
  }

  static toDomain(req: BankAccountExport, domain = new BankAccountDomain()) {
    domain.bankName = req.bankName ? (req.bankName as EncString) : undefined;
    domain.nameOnAccount = req.nameOnAccount ? (req.nameOnAccount as EncString) : undefined;
    domain.accountType = req.accountType ? (req.accountType as EncString) : undefined;
    domain.accountNumber = req.accountNumber ? (req.accountNumber as EncString) : undefined;
    domain.routingNumber = req.routingNumber ? (req.routingNumber as EncString) : undefined;
    domain.branchNumber = req.branchNumber ? (req.branchNumber as EncString) : undefined;
    domain.pin = req.pin ? (req.pin as EncString) : undefined;
    domain.swiftCode = req.swiftCode ? (req.swiftCode as EncString) : undefined;
    domain.iban = req.iban ? (req.iban as EncString) : undefined;
    domain.bankContactPhone = req.bankContactPhone
      ? (req.bankContactPhone as EncString)
      : undefined;
    return domain;
  }

  bankName: string | undefined = undefined;
  nameOnAccount: string | undefined = undefined;
  accountType: string | undefined = undefined;
  accountNumber: string | undefined = undefined;
  routingNumber: string | undefined = undefined;
  branchNumber: string | undefined = undefined;
  pin: string | undefined = undefined;
  swiftCode: string | undefined = undefined;
  iban: string | undefined = undefined;
  bankContactPhone: string | undefined = undefined;

  constructor(o?: BankAccountView | BankAccountDomain) {
    if (o == null) {
      return;
    }

    this.bankName = o.bankName ?? undefined;
    this.nameOnAccount = o.nameOnAccount ?? undefined;
    this.accountType = o.accountType ?? undefined;
    this.accountNumber = o.accountNumber ?? undefined;
    this.routingNumber = o.routingNumber ?? undefined;
    this.branchNumber = o.branchNumber ?? undefined;
    this.pin = o.pin ?? undefined;
    this.swiftCode = o.swiftCode ?? undefined;
    this.iban = o.iban ?? undefined;
    this.bankContactPhone = o.bankContactPhone ?? undefined;
  }
}

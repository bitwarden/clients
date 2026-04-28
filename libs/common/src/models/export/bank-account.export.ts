import { EncString } from "../../key-management/crypto/models/enc-string";
import { BankAccount as BankAccountDomain } from "../../vault/models/domain/bank-account";
import { BankAccountView } from "../../vault/models/view/bank-account.view";

import { safeGetString } from "./utils";

export class BankAccountExport {
  static template(): BankAccountExport {
    const req = new BankAccountExport();
    req.bankName = "";
    req.nameOnAccount = "";
    req.accountType = "";
    req.accountNumber = "";
    req.routingNumber = "";
    req.branchNumber = "";
    req.pin = "";
    req.swiftCode = "";
    req.iban = "";
    req.bankContactPhone = "";
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
    domain.bankName = req.bankName ? new EncString(req.bankName) : undefined;
    domain.nameOnAccount = req.nameOnAccount ? new EncString(req.nameOnAccount) : undefined;
    domain.accountType = req.accountType ? new EncString(req.accountType) : undefined;
    domain.accountNumber = req.accountNumber ? new EncString(req.accountNumber) : undefined;
    domain.routingNumber = req.routingNumber ? new EncString(req.routingNumber) : undefined;
    domain.branchNumber = req.branchNumber ? new EncString(req.branchNumber) : undefined;
    domain.pin = req.pin ? new EncString(req.pin) : undefined;
    domain.swiftCode = req.swiftCode ? new EncString(req.swiftCode) : undefined;
    domain.iban = req.iban ? new EncString(req.iban) : undefined;
    domain.bankContactPhone = req.bankContactPhone
      ? new EncString(req.bankContactPhone)
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

    this.bankName = safeGetString(o.bankName);
    this.nameOnAccount = safeGetString(o.nameOnAccount);
    this.accountType = safeGetString(o.accountType);
    this.accountNumber = safeGetString(o.accountNumber);
    this.routingNumber = safeGetString(o.routingNumber);
    this.branchNumber = safeGetString(o.branchNumber);
    this.pin = safeGetString(o.pin);
    this.swiftCode = safeGetString(o.swiftCode);
    this.iban = safeGetString(o.iban);
    this.bankContactPhone = safeGetString(o.bankContactPhone);
  }
}

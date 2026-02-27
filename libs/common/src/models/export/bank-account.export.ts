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
    domain.bankName = new EncString(req.bankName);
    domain.nameOnAccount = new EncString(req.nameOnAccount);
    domain.accountType = new EncString(req.accountType);
    domain.accountNumber = new EncString(req.accountNumber);
    domain.routingNumber = new EncString(req.routingNumber);
    domain.branchNumber = new EncString(req.branchNumber);
    domain.pin = new EncString(req.pin);
    domain.swiftCode = new EncString(req.swiftCode);
    domain.iban = new EncString(req.iban);
    domain.bankContactPhone = new EncString(req.bankContactPhone);
    return domain;
  }

  bankName: string;
  nameOnAccount: string;
  accountType: string;
  accountNumber: string;
  routingNumber: string;
  branchNumber: string;
  pin: string;
  swiftCode: string;
  iban: string;
  bankContactPhone: string;

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

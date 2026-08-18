import { Jsonify } from "type-fest";

import { BankAccountView as SdkBankAccountView } from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

export class BankAccountView extends ItemView implements SdkBankAccountView {
  bankName: string | undefined;
  nameOnAccount: string | undefined;
  accountType: string | undefined;
  accountNumber: string | undefined;
  routingNumber: string | undefined;
  branchNumber: string | undefined;
  pin: string | undefined;
  swiftCode: string | undefined;
  iban: string | undefined;
  bankContactPhone: string | undefined;

  get subTitle(): string {
    return this.bankName ?? "";
  }

  static fromJSON(obj: Partial<Jsonify<BankAccountView>> | undefined): BankAccountView {
    return Object.assign(new BankAccountView(), obj);
  }

  /**
   * Converts an SDK BankAccountView to a BankAccountView.
   */
  static fromSdkBankAccountView(obj: SdkBankAccountView): BankAccountView {
    const view = new BankAccountView();

    view.bankName = obj.bankName;
    view.nameOnAccount = obj.nameOnAccount;
    view.accountType = obj.accountType;
    view.accountNumber = obj.accountNumber;
    view.routingNumber = obj.routingNumber;
    view.branchNumber = obj.branchNumber;
    view.pin = obj.pin;
    view.swiftCode = obj.swiftCode;
    view.iban = obj.iban;
    view.bankContactPhone = obj.bankContactPhone;

    return view;
  }

  /**
   * Converts the BankAccountView to an SDK BankAccountView.
   *
   * Empty strings are normalized to `undefined` so that cleared fields are not encrypted and
   * stored as empty values. The SDK derives `copyableFields` from the presence of each property,
   * so a stored empty string would advertise a copy action for a field that has no value.
   */
  toSdkBankAccountView(): SdkBankAccountView {
    return {
      bankName: this.bankName || undefined,
      nameOnAccount: this.nameOnAccount || undefined,
      accountType: this.accountType || undefined,
      accountNumber: this.accountNumber || undefined,
      routingNumber: this.routingNumber || undefined,
      branchNumber: this.branchNumber || undefined,
      pin: this.pin || undefined,
      swiftCode: this.swiftCode || undefined,
      iban: this.iban || undefined,
      bankContactPhone: this.bankContactPhone || undefined,
    };
  }
}

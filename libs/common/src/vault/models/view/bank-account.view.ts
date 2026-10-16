import { Jsonify } from "type-fest";

import { BankAccountView as SdkBankAccountView } from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

// Mirrored in the SDK (bitwarden/sdk-internal: crates/bitwarden-vault/src/cipher/bank_account.rs).
// Field changes here must also be made there, along with the toSdk/fromSdk mappings.
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
   * The view implements the SdkView so we can safely return `this`.
   */
  toSdkBankAccountView(): SdkBankAccountView {
    return this;
  }
}

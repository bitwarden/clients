import { BaseResponse } from "../../../models/response/base.response";

export class BankAccountApi extends BaseResponse {
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

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.bankName = this.getResponseProperty("BankName");
    this.nameOnAccount = this.getResponseProperty("NameOnAccount");
    this.accountType = this.getResponseProperty("AccountType");
    this.accountNumber = this.getResponseProperty("AccountNumber");
    this.routingNumber = this.getResponseProperty("RoutingNumber");
    this.branchNumber = this.getResponseProperty("BranchNumber");
    this.pin = this.getResponseProperty("Pin");
    this.swiftCode = this.getResponseProperty("SwiftCode");
    this.iban = this.getResponseProperty("Iban");
    this.bankContactPhone = this.getResponseProperty("BankContactPhone");
  }
}

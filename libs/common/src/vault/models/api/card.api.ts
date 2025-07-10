// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

export class CardApi extends BaseResponse {
  cardholderName: string;
  brand: string;
  number: string;
  expMonth: string;
  expYear: string;
  code: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.cardholderName = this.getResponseProperty("CardholderName");
    this.brand = this.getResponseProperty("Brand");
    this.number = this.getResponseProperty("Number");
    this.expMonth = this.getResponseProperty("ExpMonth");
    this.expYear = this.getResponseProperty("ExpYear");
    this.code = this.getResponseProperty("Code");
  }
}

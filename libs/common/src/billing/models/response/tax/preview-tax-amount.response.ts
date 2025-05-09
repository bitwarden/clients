import { BaseResponse } from "../../../../models/response/base.response";

export class PreviewTaxAmountResponse extends BaseResponse {
  taxAmount: number;

  constructor(response: any) {
    super(response);

    this.taxAmount = this.getResponseProperty("TaxAmount");
  }
}

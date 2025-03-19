import { BaseResponse } from "../../../models/response/base.response";

export class PreviewInvoiceResponse extends BaseResponse {
  effectiveTaxRate: number;
  taxableBaseAmount: number;
  taxAmount: number;
  totalAmount: number;

  constructor(response: any) {
    super(response);
    this.effectiveTaxRate = this.getResponseProperty("EffectiveTaxRate");
    this.taxableBaseAmount = this.getResponseProperty("TaxableBaseAmount");
    this.taxAmount = this.getResponseProperty("TaxAmount");
    this.totalAmount = this.getResponseProperty("TotalAmount");
  }
}

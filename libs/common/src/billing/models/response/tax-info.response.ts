import { BaseResponse } from "../../../models/response/base.response";

export class TaxInfoResponse extends BaseResponse {
  taxId: string;
  taxIdType: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;

  constructor(response: any) {
    super(response);
    this.taxId = this.getResponseProperty("TaxIdNumber");
    if (!this.taxId) {
      this.taxId = this.getResponseProperty("TaxId");
    }
    this.taxIdType = this.getResponseProperty("TaxIdType");
    this.line1 = this.getResponseProperty("Line1");
    this.line2 = this.getResponseProperty("Line2");
    this.city = this.getResponseProperty("City");
    this.state = this.getResponseProperty("State");
    this.postalCode = this.getResponseProperty("PostalCode");
    this.country = this.getResponseProperty("Country");
  }
}

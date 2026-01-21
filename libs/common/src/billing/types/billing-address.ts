import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { TaxId, TaxIdResponse } from "./tax-id";

export type BillingAddress = {
  country: string;
  postalCode: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  taxId: TaxId | null;
};

export class BillingAddressResponse extends BaseResponse implements BillingAddress {
  country: string;
  postalCode: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  taxId: TaxId | null;

  constructor(response: any) {
    super(response);

    this.country = this.getResponseProperty("Country");
    this.postalCode = this.getResponseProperty("PostalCode");
    this.line1 = this.getResponseProperty("Line1");
    this.line2 = this.getResponseProperty("Line2");
    this.city = this.getResponseProperty("City");
    this.state = this.getResponseProperty("State");

    const taxId = this.getResponseProperty("TaxId");
    this.taxId = taxId ? new TaxIdResponse(taxId) : null;
  }
}

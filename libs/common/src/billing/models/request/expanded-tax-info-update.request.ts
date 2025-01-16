// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TaxInformation } from "../domain/tax-information";

import { TaxInfoUpdateRequest } from "./tax-info-update.request";

export class ExpandedTaxInfoUpdateRequest extends TaxInfoUpdateRequest {
  taxId: string;
  line1: string;
  line2: string;
  city: string;
  state: string;

  static From(taxInformation: TaxInformation): ExpandedTaxInfoUpdateRequest {
    if (!taxInformation) {
      return null;
    }

    const request = new ExpandedTaxInfoUpdateRequest();
    request.country = taxInformation.country;
    request.postalCode = taxInformation.postalCode;
    request.taxId = taxInformation.taxId;
    request.line1 = taxInformation.line1;
    request.line2 = taxInformation.line2;
    request.city = taxInformation.city;
    request.state = taxInformation.state;
    return request;
  }
}

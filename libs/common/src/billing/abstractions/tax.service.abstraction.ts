import { CountryListItem } from "../models/domain";
import { PreviewIndividualInvoiceRequest } from "../models/request/preview-individual-invoice.request";
import { PreviewOrganizationInvoiceRequest } from "../models/request/preview-organization-invoice.request";
import { PreviewInvoiceResponse } from "../models/response/preview-invoice.response";

export abstract class TaxServiceAbstraction {
  abstract getCountries(): CountryListItem[];

  abstract isCountrySupported(country: string): Promise<boolean>;

  abstract previewIndividualInvoice(
    request: PreviewIndividualInvoiceRequest,
  ): Promise<PreviewInvoiceResponse>;

  abstract previewOrganizationInvoice(
    request: PreviewOrganizationInvoiceRequest,
  ): Promise<PreviewInvoiceResponse>;
}

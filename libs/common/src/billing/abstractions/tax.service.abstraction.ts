import { CountryListItem } from "@bitwarden/common/billing/models/domain";
import { PreviewIndividualInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-individual-invoice.request";
import { PreviewOrganizationInvoiceRequest } from "@bitwarden/common/billing/models/request/preview-organization-invoice.request";
import { PreviewInvoiceResponse } from "@bitwarden/common/billing/models/response/preview-invoice.response";

export abstract class TaxServiceAbstraction {
  getCountries: () => CountryListItem[];

  isCountrySupported: (country: string) => Promise<boolean>;

  previewIndividualInvoice: (
    request: PreviewIndividualInvoiceRequest,
  ) => Promise<PreviewInvoiceResponse>;

  previewOrganizationInvoice: (
    request: PreviewOrganizationInvoiceRequest,
  ) => Promise<PreviewInvoiceResponse>;
}

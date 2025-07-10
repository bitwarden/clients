import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationBillingMetadataResponse extends BaseResponse {
  isEligibleForSelfHost: boolean;
  isManaged: boolean;
  isOnSecretsManagerStandalone: boolean;
  isSubscriptionUnpaid: boolean;
  hasSubscription: boolean;
  hasOpenInvoice: boolean;
  invoiceDueDate: Date | null;
  invoiceCreatedDate: Date | null;
  subPeriodEndDate: Date | null;
  isSubscriptionCanceled: boolean;
  organizationOccupiedSeats: number;

  constructor(response: any) {
    super(response);
    this.isEligibleForSelfHost = this.getResponseProperty("IsEligibleForSelfHost");
    this.isManaged = this.getResponseProperty("IsManaged");
    this.isOnSecretsManagerStandalone = this.getResponseProperty("IsOnSecretsManagerStandalone");
    this.isSubscriptionUnpaid = this.getResponseProperty("IsSubscriptionUnpaid");
    this.hasSubscription = this.getResponseProperty("HasSubscription");
    this.hasOpenInvoice = this.getResponseProperty("HasOpenInvoice");

    this.invoiceDueDate = this.parseDate(this.getResponseProperty("InvoiceDueDate"));
    this.invoiceCreatedDate = this.parseDate(this.getResponseProperty("InvoiceCreatedDate"));
    this.subPeriodEndDate = this.parseDate(this.getResponseProperty("SubPeriodEndDate"));
    this.isSubscriptionCanceled = this.getResponseProperty("IsSubscriptionCanceled");
    this.organizationOccupiedSeats = this.getResponseProperty("OrganizationOccupiedSeats");
  }

  private parseDate(dateString: any): Date | null {
    return dateString ? new Date(dateString) : null;
  }
}

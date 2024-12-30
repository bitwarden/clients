import { Injectable } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export interface ResellerWarning {
  type: "info" | "warning";
  message: string;
}

@Injectable({ providedIn: "root" })
export class ResellerWarningService {
  private readonly RENEWAL_WARNING_DAYS = 14;
  private readonly GRACE_PERIOD_DAYS = 30;

  constructor(private i18nService: I18nService) {}

  getWarning(
    organization: Organization,
    organizationBillingMetadata: OrganizationBillingMetadataResponse,
  ): ResellerWarning | null {
    if (!organization.hasReseller) {
      return null; // If no reseller, return null immediately
    }

    // Check for past due warning first (highest priority)
    if (this.shouldShowPastDueWarning(organizationBillingMetadata)) {
      const gracePeriodEnd = organizationBillingMetadata.invoiceDueDate
        ? this.getGracePeriodEndDate(organizationBillingMetadata.invoiceDueDate)
        : null;
      return {
        type: "warning",
        message: this.i18nService.t(
          "resellerPastDueWarning",
          organization.providerName,
          this.formatDate(gracePeriodEnd),
        ),
      } as ResellerWarning;
    }

    // Check for open invoice warning
    if (this.shouldShowInvoiceWarning(organizationBillingMetadata)) {
      return {
        type: "info",
        message: this.i18nService.t(
          "resellerOpenInvoiceWarning",
          organization.providerName,
          this.formatDate(organizationBillingMetadata.invoiceCreatedDate),
          this.formatDate(organizationBillingMetadata.invoiceDueDate),
        ),
      } as ResellerWarning;
    }

    // Check for renewal warning
    if (this.shouldShowRenewalWarning(organizationBillingMetadata)) {
      return {
        type: "info",
        message: this.i18nService.t(
          "resellerRenewalWarning",
          organization.providerName,
          this.formatDate(organizationBillingMetadata.subPeriodEndDate),
        ),
      } as ResellerWarning;
    }

    return null;
  }

  private shouldShowRenewalWarning(
    organizationBillingMetadata: OrganizationBillingMetadataResponse,
  ): boolean {
    const renewalDate = organizationBillingMetadata.subPeriodEndDate
      ? new Date(organizationBillingMetadata.subPeriodEndDate)
      : null;

    if (renewalDate == null) {
      return false;
    }

    const daysUntilRenewal = Math.ceil(
      (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilRenewal <= this.RENEWAL_WARNING_DAYS;
  }

  private shouldShowInvoiceWarning(
    organizationBillingMetadata: OrganizationBillingMetadataResponse,
  ): boolean {
    if (!organizationBillingMetadata.hasOpenInvoice) {
      return false;
    }
    const invoiceDueDate = new Date(organizationBillingMetadata.invoiceDueDate);
    return invoiceDueDate > new Date();
  }

  private shouldShowPastDueWarning(
    organizationBillingMetadata: OrganizationBillingMetadataResponse,
  ): boolean {
    if (!organizationBillingMetadata.hasOpenInvoice) {
      return false;
    }
    const invoiceDueDate = new Date(organizationBillingMetadata.invoiceDueDate);
    return invoiceDueDate <= new Date() && !organizationBillingMetadata.isSubscriptionUnpaid;
  }

  private getGracePeriodEndDate(dueDate: Date | null): Date | null {
    if (!dueDate) {
      return null;
    }
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + this.GRACE_PERIOD_DAYS);
    return gracePeriodEnd;
  }

  private formatDate(date: Date | string | null): string {
    if (!date) {
      return "";
    }
    return new Date(date).toLocaleDateString();
  }
}

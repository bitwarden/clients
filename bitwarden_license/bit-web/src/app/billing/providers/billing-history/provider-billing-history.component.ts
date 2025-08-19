// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { InvoiceResponse } from "@bitwarden/common/billing/models/response/invoices.response";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";

@Component({
  templateUrl: "./provider-billing-history.component.html",
  standalone: false,
})
export class ProviderBillingHistoryComponent {
  private providerId: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private billingApiService: BillingApiServiceAbstraction,
    private datePipe: DatePipe,
    private billingNotificationService: BillingNotificationService,
  ) {
    this.activatedRoute.params
      .pipe(
        map(({ providerId }) => {
          this.providerId = providerId;
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  getClientInvoiceReport = async (invoiceId: string) => {
    try {
      return await this.billingApiService.getProviderClientInvoiceReport(
        this.providerId,
        invoiceId,
      );
    } catch (error) {
      this.billingNotificationService.handleError(error);
    }
  };

  getClientInvoiceReportName = (invoice: InvoiceResponse) => {
    const date = this.datePipe.transform(invoice.date, "yyyyMMdd");
    return `bitwarden_provider-billing-history_${date}_${invoice.number}`;
  };

  getInvoices = async () => {
    try {
      return await this.billingApiService.getProviderInvoices(this.providerId);
    } catch (error) {
      this.billingNotificationService.handleError(error);
    }
  };
}

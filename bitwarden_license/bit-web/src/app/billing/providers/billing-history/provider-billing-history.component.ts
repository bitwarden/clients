// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { InvoiceResponse } from "@bitwarden/common/billing/models/response/invoices.response";

@Component({
  templateUrl: "./provider-billing-history.component.html",
})
export class ProviderBillingHistoryComponent {
  private providerId: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private billingApiService: BillingApiServiceAbstraction,
    private datePipe: DatePipe,
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

  getClientInvoiceReport = (invoiceId: string) =>
    this.billingApiService.getProviderClientInvoiceReport(this.providerId, invoiceId);

  getClientInvoiceReportName = (invoice: InvoiceResponse) => {
    const date = this.datePipe.transform(invoice.date, "yyyyMMdd");
    return `bitwarden_provider-billing-history_${date}_${invoice.number}`;
  };

  getInvoices = async () => await this.billingApiService.getProviderInvoices(this.providerId);
}

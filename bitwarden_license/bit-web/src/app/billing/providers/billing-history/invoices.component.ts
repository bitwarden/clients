// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";

import {
  InvoiceResponse,
  InvoicesResponse,
} from "@bitwarden/common/billing/models/response/invoices.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-invoices",
  templateUrl: "./invoices.component.html",
  standalone: false,
})
export class InvoicesComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() startWith?: InvoicesResponse;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() getInvoices?: () => Promise<InvoicesResponse>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() getClientInvoiceReport?: (invoiceId: string) => Promise<string>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() getClientInvoiceReportName?: (invoiceResponse: InvoiceResponse) => string;

  protected invoices: InvoiceResponse[] = [];
  protected loading = true;

  constructor(private fileDownloadService: FileDownloadService) {}

  runExport = async (invoiceId: string): Promise<void> => {
    const blobData = await this.getClientInvoiceReport(invoiceId);
    let fileName = "report.csv";
    if (this.getClientInvoiceReportName) {
      const invoice = this.invoices.find((invoice) => invoice.id === invoiceId);
      fileName = this.getClientInvoiceReportName(invoice);
    }
    this.fileDownloadService.download({
      fileName,
      blobData,
      blobOptions: {
        type: "text/csv",
      },
    });
  };

  async ngOnInit(): Promise<void> {
    if (this.startWith) {
      this.invoices = this.startWith.invoices;
    } else if (this.getInvoices) {
      const response = await this.getInvoices();
      this.invoices = response.invoices;
    }
    this.loading = false;
  }

  expandInvoiceStatus = (
    invoice: InvoiceResponse,
  ): "open" | "unpaid" | "paid" | "uncollectible" => {
    switch (invoice.status) {
      case "open": {
        const dueDate = new Date(invoice.dueDate);
        return dueDate < new Date() ? "unpaid" : invoice.status;
      }
      case "paid":
      case "uncollectible": {
        return invoice.status;
      }
    }
  };
}

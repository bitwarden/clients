// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";

import {
  InvoiceResponse,
  InvoicesResponse,
} from "@bitwarden/common/billing/models/response/invoices.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";

@Component({
  selector: "app-invoices",
  templateUrl: "./invoices.component.html",
})
export class InvoicesComponent implements OnInit {
  @Input() startWith?: InvoicesResponse;
  @Input() getInvoices?: () => Promise<InvoicesResponse>;
  @Input() getClientInvoiceReport?: (invoiceId: string) => Promise<string>;
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

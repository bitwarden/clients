import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class InvoicesResponse extends BaseResponse {
  invoices: InvoiceResponse[] = [];

  constructor(response: any) {
    super(response);
    const invoices = this.getResponseProperty("Invoices");
    if (invoices && invoices.length) {
      this.invoices = invoices.map((t: any) => new InvoiceResponse(t));
    }
  }
}

export class InvoiceResponse extends BaseResponse {
  id: string;
  date: string;
  number: string;
  total: number;
  status: string;
  dueDate: string;
  url: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.date = this.getResponseProperty("Date");
    this.number = this.getResponseProperty("Number");
    this.total = this.getResponseProperty("Total");
    this.status = this.getResponseProperty("Status");
    this.dueDate = this.getResponseProperty("DueDate");
    this.url = this.getResponseProperty("Url");
  }
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { PaymentMethodType, TransactionType } from "@bitwarden/common/billing/enums";
import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "@bitwarden/common/billing/models/response/billing.response";

@Component({
  selector: "app-billing-history",
  templateUrl: "billing-history.component.html",
  standalone: false,
})
export class BillingHistoryComponent {
  @Input()
  openInvoices: BillingInvoiceResponse[];

  @Input()
  paidInvoices: BillingInvoiceResponse[];

  @Input()
  transactions: BillingTransactionResponse[];

  paymentMethodType = PaymentMethodType;
  transactionType = TransactionType;

  paymentMethodClasses(type: PaymentMethodType) {
    switch (type) {
      case PaymentMethodType.Card:
        return ["bwi-credit-card"];
      case PaymentMethodType.BankAccount:
      case PaymentMethodType.WireTransfer:
        return ["bwi-billing"];
      case PaymentMethodType.BitPay:
        return ["bwi-bitcoin text-warning"];
      case PaymentMethodType.PayPal:
        return ["bwi-paypal text-primary"];
      default:
        return [];
    }
  }
}

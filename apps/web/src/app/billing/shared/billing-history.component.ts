import { Component, Input, OnInit } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PaymentMethodType, TransactionType } from "@bitwarden/common/billing/enums";
import { SubscriberEntityType } from "@bitwarden/common/billing/enums/subscriber-entity-type.enum";
import { BillingHistoryResponse } from "@bitwarden/common/billing/models/response/billing-history.response";

@Component({
  selector: "app-billing-history",
  templateUrl: "billing-history.component.html",
})
export class BillingHistoryComponent implements OnInit {
  @Input()
  subscriberEntityId: string;

  @Input()
  subscriberEntityType: SubscriberEntityType;

  paymentMethodType = PaymentMethodType;
  transactionType = TransactionType;
  loading = false;
  billing: BillingHistoryResponse;

  constructor(
    private apiService: ApiService,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    await this.load();
  }

  get invoices() {
    return this.billing != null ? this.billing.invoices : null;
  }

  get transactions() {
    return this.billing != null ? this.billing.transactions : null;
  }

  paymentMethodClasses(type: PaymentMethodType) {
    switch (type) {
      case PaymentMethodType.Card:
        return ["bwi-credit-card"];
      case PaymentMethodType.BankAccount:
      case PaymentMethodType.WireTransfer:
        return ["bwi-bank"];
      case PaymentMethodType.BitPay:
        return ["bwi-bitcoin text-warning"];
      case PaymentMethodType.PayPal:
        return ["bwi-paypal text-primary"];
      default:
        return [];
    }
  }

  async load() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    if (this.subscriberEntityType === SubscriberEntityType.User) {
      this.billing = await this.apiService.getUserBillingHistory();
    } else if (this.subscriberEntityType === SubscriberEntityType.Organization) {
      this.billing = await this.organizationApiService.getBillingHistory(this.subscriberEntityId);
    }

    this.loading = false;
  }

  loadMoreInvoices() {}

  loadMoreTransactions() {}
}

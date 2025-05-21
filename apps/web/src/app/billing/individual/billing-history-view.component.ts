// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { AccountBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/account/account-billing-api.service.abstraction";
import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "@bitwarden/common/billing/models/response/billing.response";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  templateUrl: "billing-history-view.component.html",
  standalone: false,
})
export class BillingHistoryViewComponent implements OnInit {
  loading = false;
  firstLoaded = false;
  openInvoices: BillingInvoiceResponse[] = [];
  paidInvoices: BillingInvoiceResponse[] = [];
  transactions: BillingTransactionResponse[] = [];
  hasAdditionalHistory: boolean = false;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private accountBillingApiService: AccountBillingApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    if (this.platformUtilsService.isSelfHost()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/settings/subscription"]);
      return;
    }
    await this.load();
    this.firstLoaded = true;
  }

  async load() {
    if (this.loading) {
      return;
    }
    this.loading = true;

    const openInvoicesPromise = this.accountBillingApiService.getBillingInvoices(
      "open",
      this.openInvoices.length > 0 ? this.openInvoices[this.openInvoices.length - 1].id : null,
    );

    const paidInvoicesPromise = this.accountBillingApiService.getBillingInvoices(
      "paid",
      this.paidInvoices.length > 0 ? this.paidInvoices[this.paidInvoices.length - 1].id : null,
    );

    const transactionsPromise = this.accountBillingApiService.getBillingTransactions(
      this.transactions.length > 0
        ? this.transactions[this.transactions.length - 1].createdDate
        : null,
    );

    const openInvoices = await openInvoicesPromise;
    const paidInvoices = await paidInvoicesPromise;
    const transactions = await transactionsPromise;

    const pageSize = 5;

    this.openInvoices = [...this.openInvoices, ...openInvoices];
    this.paidInvoices = [...this.paidInvoices, ...paidInvoices];
    this.transactions = [...this.transactions, ...transactions];

    this.hasAdditionalHistory =
      openInvoices.length >= pageSize ||
      paidInvoices.length >= pageSize ||
      transactions.length >= pageSize;

    this.loading = false;
  }
}

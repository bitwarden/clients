// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, Subject, takeUntil } from "rxjs";

import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import {
  BillingInvoiceResponse,
  BillingTransactionResponse,
} from "@bitwarden/common/billing/models/response/billing.response";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "organization-billing-history-view.component.html",
  standalone: false,
})
export class OrgBillingHistoryViewComponent implements OnInit, OnDestroy {
  loading = false;
  firstLoaded = false;
  openInvoices: BillingInvoiceResponse[] = [];
  paidInvoices: BillingInvoiceResponse[] = [];
  transactions: BillingTransactionResponse[] = [];
  organizationId: string;
  hasAdditionalHistory: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private organizationBillingApiService: OrganizationBillingApiServiceAbstraction,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit() {
    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.organizationId = params.organizationId;
          await this.load();
          this.firstLoaded = true;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    const openInvoicesPromise = this.organizationBillingApiService.getBillingInvoices(
      this.organizationId,
      "open",
      this.openInvoices.length > 0 ? this.openInvoices[this.openInvoices.length - 1].id : null,
    );

    const paidInvoicesPromise = this.organizationBillingApiService.getBillingInvoices(
      this.organizationId,
      "paid",
      this.paidInvoices.length > 0 ? this.paidInvoices[this.paidInvoices.length - 1].id : null,
    );

    const transactionsPromise = this.organizationBillingApiService.getBillingTransactions(
      this.organizationId,
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
      openInvoices.length <= pageSize ||
      paidInvoices.length <= pageSize ||
      transactions.length <= pageSize;

    this.loading = false;
  }
}

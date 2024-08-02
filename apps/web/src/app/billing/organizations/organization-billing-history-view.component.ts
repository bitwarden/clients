import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, Subject, takeUntil } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { SubscriberEntityType } from "@bitwarden/common/billing/enums/subscriber-entity-type.enum";
import { BillingHistoryResponse } from "@bitwarden/common/billing/models/response/billing-history.response";

@Component({
  templateUrl: "organization-billing-history-view.component.html",
})
export class OrgBillingHistoryViewComponent implements OnInit, OnDestroy {
  loading = false;
  firstLoaded = false;
  billing: BillingHistoryResponse;
  organizationId: string;

  private destroy$ = new Subject<void>();

  constructor(
    private organizationApiService: OrganizationApiServiceAbstraction,
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
    this.billing = await this.organizationApiService.getBillingHistory(this.organizationId);
    this.loading = false;
  }

  protected readonly SubscriberEntityType = SubscriberEntityType;
}

import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import {
  AllActivitiesService,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ActivityCardComponent } from "./activity-card.component";
import { ApplicationsLoadingComponent } from "./risk-insights-loading.component";
import { RiskInsightsTabType } from "./risk-insights.component";

@Component({
  selector: "tools-all-activity",
  imports: [ApplicationsLoadingComponent, SharedModule, ActivityCardComponent],
  templateUrl: "./all-activity.component.html",
})
export class AllActivityComponent implements OnInit {
  protected isLoading$ = this.dataService.isLoading$;
  protected noData$ = new BehaviorSubject(true);
  organization: Organization | null = null;
  totalCriticalAppsAtRiskMemberCount = 0;
  totalCriticalAppsCount = 0;
  totalCriticalAppsAtRiskCount = 0;

  destroyRef = inject(DestroyRef);

  async ngOnInit(): Promise<void> {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (organizationId) {
      this.organization =
        (await firstValueFrom(
          this.organizationService.organizations$(userId).pipe(getById(organizationId)),
        )) ?? null;

      this.allActivitiesService.reportSummary$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((summary) => {
          this.noData$.next(summary.totalApplicationCount === 0);
          this.totalCriticalAppsAtRiskMemberCount = summary.totalCriticalAtRiskMemberCount;
          this.totalCriticalAppsCount = summary.totalCriticalApplicationCount;
          this.totalCriticalAppsAtRiskCount = summary.totalCriticalAtRiskApplicationCount;
        });
    }
  }

  constructor(
    protected activatedRoute: ActivatedRoute,
    private accountService: AccountService,
    protected organizationService: OrganizationService,
    protected dataService: RiskInsightsDataService,
    protected allActivitiesService: AllActivitiesService,
  ) {}

  get RiskInsightsTabType() {
    return RiskInsightsTabType;
  }

  getLinkForRiskInsightsTab(tabIndex: RiskInsightsTabType): string {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    return `/organizations/${organizationId}/access-intelligence/risk-insights?tabIndex=${tabIndex}`;
  }
}

import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, firstValueFrom, of, switchMap } from "rxjs";

import {
  CriticalAppsService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ActivityCardComponent } from "./activity-card.component";
import { ApplicationsLoadingComponent } from "./risk-insights-loading.component";

@Component({
  selector: "tools-all-activity",
  imports: [ApplicationsLoadingComponent, SharedModule, ActivityCardComponent],
  templateUrl: "./all-activity.component.html",
})
export class AllActivityComponent implements OnInit {
  protected isLoading$ = this.dataService.isLoading$;
  protected noData$ = new BehaviorSubject(true);
  organization: Organization | null = null;
  atRiskMemberCount = 0;
  criticalApplicationsCount = 0;

  destroyRef = inject(DestroyRef);

  async ngOnInit(): Promise<void> {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (organizationId) {
      this.organization =
        (await firstValueFrom(
          this.organizationService.organizations$(userId).pipe(getById(organizationId)),
        )) ?? null;
    }

    this.dataService.applications$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((apps) => {
          const atRiskMembers = this.reportService.generateAtRiskMemberList(apps ?? []);
          return of({ apps, atRiskMembers });
        }),
      )
      .subscribe(({ apps, atRiskMembers }) => {
        this.noData$.next((apps?.length ?? 0) === 0);
        this.atRiskMemberCount = atRiskMembers?.length;
      });
  }

  constructor(
    protected activatedRoute: ActivatedRoute,
    private accountService: AccountService,
    protected organizationService: OrganizationService,
    protected dataService: RiskInsightsDataService,
    protected reportService: RiskInsightsReportService,
    protected criticalAppsService: CriticalAppsService,
  ) {}
}

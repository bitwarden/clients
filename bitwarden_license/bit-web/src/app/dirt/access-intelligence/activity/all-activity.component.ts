import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  AllActivitiesService,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { RiskInsightsTabType } from "../models/risk-insights.models";
import { ApplicationsLoadingComponent } from "../shared/risk-insights-loading.component";

import { ActivityCardComponent } from "./activity-card.component";
import { PasswordChangeMetricComponent } from "./activity-cards/password-change-metric.component";
import { NewApplicationsDialogComponent } from "./new-applications-dialog.component";

@Component({
  selector: "dirt-all-activity",
  imports: [
    ApplicationsLoadingComponent,
    SharedModule,
    ActivityCardComponent,
    PasswordChangeMetricComponent,
  ],
  templateUrl: "./all-activity.component.html",
})
export class AllActivityComponent implements OnInit {
  organization: Organization | null = null;
  totalCriticalAppsAtRiskMemberCount = 0;
  totalCriticalAppsCount = 0;
  totalCriticalAppsAtRiskCount = 0;
  newApplicationsCount = 0;
  newApplications: string[] = [];
  passwordChangeMetricHasProgressBar = false;

  destroyRef = inject(DestroyRef);

  constructor(
    private accountService: AccountService,
    protected activatedRoute: ActivatedRoute,
    protected allActivitiesService: AllActivitiesService,
    protected dataService: RiskInsightsDataService,
    private dialogService: DialogService,
    protected organizationService: OrganizationService,
  ) {}

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
          this.totalCriticalAppsAtRiskMemberCount = summary.totalCriticalAtRiskMemberCount;
          this.totalCriticalAppsCount = summary.totalCriticalApplicationCount;
          this.totalCriticalAppsAtRiskCount = summary.totalCriticalAtRiskApplicationCount;
          this.newApplications = summary.newApplications;
          this.newApplicationsCount = summary.newApplications.length;
        });

      this.allActivitiesService.passwordChangeProgressMetricHasProgressBar$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((hasProgressBar) => {
          this.passwordChangeMetricHasProgressBar = hasProgressBar;
        });
    }
  }

  get RiskInsightsTabType() {
    return RiskInsightsTabType;
  }

  getLinkForRiskInsightsTab(tabIndex: RiskInsightsTabType): string {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    return `/organizations/${organizationId}/access-intelligence/risk-insights?tabIndex=${tabIndex}`;
  }

  /**
   * Handles the review new applications button click.
   * Opens a dialog showing the list of new applications that can be marked as critical.
   */
  onReviewNewApplications = async () => {
    const dialogRef = NewApplicationsDialogComponent.open(this.dialogService, {
      newApplications: this.newApplications,
    });

    await firstValueFrom(dialogRef.closed);
  };

  /**
   * Handles the "View at-risk members" link click.
   * Opens the at-risk members drawer for critical applications only.
   */
  onViewAtRiskMembers = async () => {
    await this.dataService.setDrawerForCriticalAtRiskMembers("activityTabAtRiskMembers");
  };

  /**
   * Handles the "View at-risk applications" link click.
   * Opens the at-risk applications drawer for critical applications only.
   */
  onViewAtRiskApplications = async () => {
    await this.dataService.setDrawerForCriticalAtRiskApps("activityTabAtRiskApplications");
  };
}

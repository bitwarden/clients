import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import {
  AllActivitiesService,
  ApplicationHealthReportDetail,
  ReportStatus,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ApplicationsLoadingComponent } from "../shared/risk-insights-loading.component";

import { ActivityCardComponent } from "./activity-card.component";
import { PasswordChangeMetricComponent } from "./activity-cards/password-change-metric.component";
import { NewApplicationsDialogComponent } from "./application-review-dialog/new-applications-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  newApplications: ApplicationHealthReportDetail[] = [];
  passwordChangeMetricHasProgressBar = false;
  allAppsHaveReviewDate = false;
  isAllCaughtUp = false;
  hasLoadedApplicationData = false;

  destroyRef = inject(DestroyRef);

  protected ReportStatusEnum = ReportStatus;

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
        });

      this.dataService.newApplications$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((newApps) => {
          this.newApplications = newApps;
          this.newApplicationsCount = newApps.length;
          this.updateIsAllCaughtUp();
        });

      this.allActivitiesService.passwordChangeProgressMetricHasProgressBar$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((hasProgressBar) => {
          this.passwordChangeMetricHasProgressBar = hasProgressBar;
        });

      this.dataService.enrichedReportData$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((enrichedData) => {
          if (enrichedData?.applicationData && enrichedData.applicationData.length > 0) {
            this.hasLoadedApplicationData = true;
            // Check if all apps have a review date (not null and not undefined)
            this.allAppsHaveReviewDate = enrichedData.applicationData.every(
              (app) => app.reviewedDate !== null && app.reviewedDate !== undefined,
            );
          } else {
            this.hasLoadedApplicationData = enrichedData !== null;
            this.allAppsHaveReviewDate = false;
          }
          this.updateIsAllCaughtUp();
        });
    }
  }

  /**
   * Updates the isAllCaughtUp flag based on current state.
   * Only shows "All caught up!" when:
   * - Data has been loaded (hasLoadedApplicationData is true)
   * - No new applications need review
   * - All apps have a review date
   */
  private updateIsAllCaughtUp(): void {
    this.isAllCaughtUp =
      this.hasLoadedApplicationData &&
      this.newApplicationsCount === 0 &&
      this.allAppsHaveReviewDate;
  }

  /**
   * Handles the review new applications button click.
   * Opens a dialog showing the list of new applications that can be marked as critical.
   */
  async onReviewNewApplications() {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");

    if (!organizationId) {
      return;
    }

    // Pass organizationId via dialog data instead of having the dialog retrieve it from route.
    // This ensures organizationId is immediately available when dialog opens, preventing
    // timing issues where the dialog's checkForTasksToAssign() method runs before
    // organizationId is populated via async route subscription.
    const dialogRef = NewApplicationsDialogComponent.open(this.dialogService, {
      newApplications: this.newApplications,
      organizationId: organizationId as OrganizationId,
    });

    await lastValueFrom(dialogRef.closed);
  }

  /**
   * Handles the "View at-risk members" link click.
   * Opens the at-risk members drawer for critical applications only.
   */
  async onViewAtRiskMembers() {
    await this.dataService.setDrawerForCriticalAtRiskMembers("activityTabAtRiskMembers");
  }

  /**
   * Handles the "View at-risk applications" link click.
   * Opens the at-risk applications drawer for critical applications only.
   */
  async onViewAtRiskApplications() {
    await this.dataService.setDrawerForCriticalAtRiskApps("activityTabAtRiskApplications");
  }
}

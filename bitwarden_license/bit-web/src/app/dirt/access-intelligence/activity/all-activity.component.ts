import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { finalize } from "rxjs/operators";

import {
  AllActivitiesService,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { DialogService, ToastService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ApplicationsLoadingComponent } from "../shared/risk-insights-loading.component";

import { ActivityCardComponent } from "./activity-card.component";
import { PasswordChangeMetricComponent } from "./activity-cards/password-change-metric.component";
import { NewApplicationsDialogComponent } from "./new-applications-dialog.component";

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
  newApplications: string[] = [];
  passwordChangeMetricHasProgressBar = false;

  destroyRef = inject(DestroyRef);

  constructor(
    private accountService: AccountService,
    protected activatedRoute: ActivatedRoute,
    protected allActivitiesService: AllActivitiesService,
    protected dataService: RiskInsightsDataService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    protected organizationService: OrganizationService,
    private toastService: ToastService,
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

  /**
   * Handles the review new applications button click.
   * Opens a dialog showing the list of new applications that can be marked as critical.
   * When user clicks Continue, saves review status and critical markings via orchestrator.
   */
  onReviewNewApplications = async () => {
    const dialogRef = NewApplicationsDialogComponent.open(this.dialogService, {
      newApplications: this.newApplications,
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result?.saved) {
      // User clicked Continue - save review status and critical flags
      let isSaving = true;

      firstValueFrom(
        this.dataService.saveApplicationReviewStatus(result.selectedApplications).pipe(
          finalize(() => {
            isSaving = false;
          }),
        ),
      )
        .then(() => {
          // Success - data will update automatically through reactive pipeline
          if (result.selectedApplications.length > 0) {
            this.toastService.showToast({
              variant: "success",
              title: this.i18nService.t("success"),
              message: this.i18nService.t(
                "applicationsCriticalMarked",
                result.selectedApplications.length.toString(),
              ),
            });
          } else {
            this.toastService.showToast({
              variant: "success",
              title: this.i18nService.t("success"),
              message: this.i18nService.t("applicationsReviewed"),
            });
          }
        })
        .catch((error) => {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("error"),
            message: this.i18nService.t("failedToSaveApplications"),
          });
        });
    }
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

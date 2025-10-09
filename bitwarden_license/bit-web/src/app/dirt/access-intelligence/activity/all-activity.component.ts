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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { ToastService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { RiskInsightsTabType } from "../models/risk-insights.models";
import { ApplicationsLoadingComponent } from "../shared/risk-insights-loading.component";

import { ActivityCardComponent } from "./activity-card.component";
import { PasswordChangeMetricComponent } from "./activity-cards/password-change-metric.component";

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
  passwordChangeMetricHasProgressBar = false;

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
          this.totalCriticalAppsAtRiskMemberCount = summary.totalCriticalAtRiskMemberCount;
          this.totalCriticalAppsCount = summary.totalCriticalApplicationCount;
          this.totalCriticalAppsAtRiskCount = summary.totalCriticalAtRiskApplicationCount;
          this.newApplicationsCount = summary.newApplications.length;
        });

      this.allActivitiesService.passwordChangeProgressMetricHasProgressBar$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((hasProgressBar) => {
          this.passwordChangeMetricHasProgressBar = hasProgressBar;
        });
    }
  }

  constructor(
    protected activatedRoute: ActivatedRoute,
    private accountService: AccountService,
    protected organizationService: OrganizationService,
    protected dataService: RiskInsightsDataService,
    protected allActivitiesService: AllActivitiesService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  get RiskInsightsTabType() {
    return RiskInsightsTabType;
  }

  getLinkForRiskInsightsTab(tabIndex: RiskInsightsTabType): string {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    return `/organizations/${organizationId}/access-intelligence/risk-insights?tabIndex=${tabIndex}`;
  }

  /**
   * Handles the review new applications button click.
   * Shows a toast notification as a placeholder until the dialog is implemented.
   * TODO: Implement dialog for reviewing new applications (follow-up task)
   */
  onReviewNewApplications = () => {
    this.toastService.showToast({
      variant: "info",
      title: this.i18nService.t("applicationsNeedingReview"),
      message: this.i18nService.t("newApplicationsWithCount", this.newApplicationsCount.toString()),
    });
  };
}

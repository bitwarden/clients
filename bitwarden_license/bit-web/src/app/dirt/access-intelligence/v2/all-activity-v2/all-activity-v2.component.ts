import { Component, inject, ChangeDetectionStrategy, computed, input, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { lastValueFrom } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ActivityCardComponent } from "../../activity/activity-card.component";
import { ReportLoadingComponent } from "../../shared/report-loading.component";
import { NewApplicationsDialogV2Component } from "../new-applications-dialog-v2/new-applications-dialog-v2.component";
import { PasswordChangeMetricV2Component } from "../password-change-metric-v2/password-change-metric-v2.component";

/**
 * AllActivityV2Component - Activity dashboard for Access Intelligence V2 architecture
 *
 * Displays high-level metrics and cards for:
 * - Password change progress
 * - At-risk members in critical applications
 * - Critical applications health
 * - New applications needing review
 *
 * Key V2 patterns:
 * - Uses toSignal() to convert service observables to signals
 * - All state management via signals and computed() (no manual subscriptions)
 * - Integrates with AccessIntelligenceDataService for reactive data updates
 */
@Component({
  selector: "app-all-activity-v2",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./all-activity-v2.component.html",
  imports: [
    ReportLoadingComponent,
    SharedModule,
    ActivityCardComponent,
    PasswordChangeMetricV2Component,
  ],
})
export class AllActivityV2Component {
  // Services
  private accessIntelligenceService = inject(AccessIntelligenceDataService);
  private drawerStateService = inject(DrawerStateService);
  private dialogService = inject(DialogService);

  // Inputs
  readonly organizationId = input.required<OrganizationId>();

  // Convert service observables to signals
  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
  protected readonly loading = toSignal(this.accessIntelligenceService.loading$, {
    initialValue: false,
  });

  // Local state signals
  protected readonly extendPasswordChangeWidget = signal(false);

  // Computed summary metrics from report
  protected readonly totalCriticalAppsAtRiskMemberCount = computed(() => {
    const report = this.report();
    if (!report) {
      return 0;
    }

    const criticalApps = report.getCriticalApplications();
    const atRiskMemberIds = new Set<string>();

    criticalApps.forEach((app) => {
      Object.entries(app.memberRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .forEach(([memberId]) => atRiskMemberIds.add(memberId));
    });

    return atRiskMemberIds.size;
  });

  protected readonly totalCriticalAppsCount = computed(() => {
    const report = this.report();
    return report?.getCriticalApplications().length ?? 0;
  });

  protected readonly totalCriticalAppsAtRiskCount = computed(() => {
    const report = this.report();
    if (!report) {
      return 0;
    }

    const criticalApps = report.getCriticalApplications();
    return criticalApps.filter((app) => app.isAtRisk()).length;
  });

  protected readonly totalApplicationCount = computed(() => {
    const report = this.report();
    return report?.reports.length ?? 0;
  });

  protected readonly newApplications = computed(() => {
    const report = this.report();
    if (!report) {
      return [];
    }

    return report.getNewApplications();
  });

  protected readonly newApplicationsCount = computed(() => {
    return this.newApplications().length;
  });

  protected readonly activityViewState = computed((): "caught-up" | "needs-review" | "default" => {
    const report = this.report();
    if (report == null || report.reports.length === 0) {
      return "default";
    }
    if (
      this.newApplicationsCount() === 0 &&
      report.applications.length > 0 &&
      report.applications.every((app) => app.reviewedDate != null)
    ) {
      return "caught-up";
    }
    if (this.newApplicationsCount() === report.reports.length) {
      return "needs-review";
    }
    return "default";
  });

  /**
   * Handles the review new applications button click.
   * Opens V2 dialog showing the list of new applications that can be marked as critical.
   */
  onReviewNewApplications = async () => {
    const dialogRef = NewApplicationsDialogV2Component.open(this.dialogService, {
      newApplications: this.newApplications(),
      organizationId: this.organizationId(),
      hasExistingCriticalApplications: this.totalCriticalAppsCount() > 0,
    });

    await lastValueFrom(dialogRef.closed);
  };

  /**
   * Handles the "View at-risk members" link click.
   * Opens the at-risk members drawer for critical applications only.
   */
  onViewAtRiskMembers = () => {
    this.drawerStateService.openDrawer(
      DrawerType.CriticalAtRiskMembers,
      "activityTabAtRiskMembers",
    );
  };

  /**
   * Handles the "View at-risk applications" link click.
   * Opens the at-risk applications drawer for critical applications only.
   */
  onViewAtRiskApplications = () => {
    this.drawerStateService.openDrawer(
      DrawerType.CriticalAtRiskApps,
      "activityTabAtRiskApplications",
    );
  };

  /**
   * Callback for PasswordChangeMetricV2Component to control layout.
   * When the password widget has a progress bar, it should span 2 columns.
   */
  setExtendPasswordWidget = (hasProgressBar: boolean) => {
    this.extendPasswordChangeWidget.set(hasProgressBar);
  };
}

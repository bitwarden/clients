import { NgClass } from "@angular/common";
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { lastValueFrom } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, PopoverModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ActivityCardComponent } from "../../activity/activity-card.component";
import {
  DEFAULT_TIME_PERIOD,
  TimePeriod,
} from "../../activity/period-selector/period-selector.types";
import {
  TrendWidgetComponent,
  TrendWidgetViewType,
} from "../../activity/trend-widget/trend-widget.component";
import { AccessIntelligenceCoachmarkComponent } from "../../onboarding/access-intelligence-coachmark.component";
import { AccessIntelligenceCoachmarkService } from "../../onboarding/access-intelligence-coachmark.service";
import { RiskOverTimeService } from "../../services/risk-over-time.service";
import { ReportLoadingComponent } from "../../shared/report-loading.component";

import { NewApplicationsDialogV2Component } from "./new-applications-dialog-v2/new-applications-dialog-v2.component";
import { PasswordChangeMetricV2Component } from "./password-change-metric-v2/password-change-metric-v2.component";

/**
 * Displays the Access Intelligence activity dashboard.
 *
 * Shows high-level metric cards for:
 * - Password change task progress
 * - At-risk members across critical applications
 * - Critical application health summary
 * - New applications needing review
 */
@Component({
  selector: "app-activity-tab",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./activity-tab.component.html",
  imports: [
    NgClass,
    I18nPipe,
    ReportLoadingComponent,
    ActivityCardComponent,
    PasswordChangeMetricV2Component,
    AccessIntelligenceCoachmarkComponent,
    PopoverModule,
    TrendWidgetComponent,
  ],
})
export class ActivityTabComponent {
  private readonly accessIntelligenceService = inject(AccessIntelligenceDataService);
  private readonly drawerStateService = inject(DrawerStateService);
  private readonly dialogService = inject(DialogService);
  private readonly coachmarkService = inject(AccessIntelligenceCoachmarkService);
  private readonly configService = inject(ConfigService);
  private readonly riskOverTimeService = inject(RiskOverTimeService);

  readonly organizationId = input.required<OrganizationId>();

  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
  protected readonly loading = toSignal(this.accessIntelligenceService.loading$, {
    initialValue: false,
  });

  protected readonly extendPasswordChangeWidget = signal(false);

  protected readonly trendChartEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.AccessIntelligenceTrendChart),
    { initialValue: false },
  );

  protected readonly riskOverTimeData = toSignal(this.riskOverTimeService.riskOverTimeData$);
  protected readonly isRiskOverTimeLoading = toSignal(this.riskOverTimeService.isLoading$, {
    initialValue: false,
  });
  protected readonly riskOverTimeError = toSignal(this.riskOverTimeService.error$, {
    initialValue: null,
  });

  constructor() {
    // Initialize the trend chart when the feature flag and organization id are available
    // and re-initialize if the organization id changes (e.g., user switches orgs)
    effect(() => {
      const flag = this.trendChartEnabled();
      const orgId = this.organizationId();
      if (flag && orgId) {
        this.riskOverTimeService.initialize(
          orgId,
          DEFAULT_TIME_PERIOD,
          TrendWidgetViewType.Applications,
        );
      }
    });
  }

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

  protected readonly prioritizeRisksOpen = computed(
    () => this.coachmarkService.activeStepId() === "prioritizeRisks",
  );

  /**
   * Handles the review new applications button click.
   * Opens V2 dialog showing the list of new applications that can be marked as critical.
   */
  protected readonly onReviewNewApplications = async () => {
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
  protected readonly onViewAtRiskMembers = () => {
    this.drawerStateService.toggleDrawer(
      DrawerType.CriticalAtRiskMembers,
      "activityTabAtRiskMembers",
    );
  };

  /**
   * Handles the "View at-risk applications" link click.
   * Opens the at-risk applications drawer for critical applications only.
   */
  protected readonly onViewAtRiskApplications = () => {
    this.drawerStateService.toggleDrawer(
      DrawerType.CriticalAtRiskApps,
      "activityTabAtRiskApplications",
    );
  };

  /**
   * Callback for PasswordChangeMetricV2Component to control layout.
   * When the password widget has a progress bar, it should span 2 columns.
   */
  protected readonly setExtendPasswordWidget = (hasProgressBar: boolean) => {
    this.extendPasswordChangeWidget.set(hasProgressBar);
  };

  protected readonly onTimespanChanged = (timeframe: TimePeriod) => {
    this.riskOverTimeService.setTimeframe(timeframe);
  };

  protected readonly onViewChanged = (dataView: TrendWidgetViewType) => {
    this.riskOverTimeService.setDataView(dataView);
  };
}

import { signal } from "@angular/core";
import { componentWrapperDecorator } from "@storybook/angular";
import { BehaviorSubject, EMPTY, of } from "rxjs";
import { action } from "storybook/actions";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { TaskMetrics } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTask } from "@bitwarden/common/vault/tasks";
import { DialogService, I18nMockService } from "@bitwarden/components";

import { ChartExportService } from "../../../shared/chart-export.service";
import { TrendWidgetData } from "../../activity/trend-widget/trend-widget.component";
import { AccessIntelligenceCoachmarkStepId } from "../../onboarding/access-intelligence-coachmark-step";
import { RiskOverTimeService } from "../../services/risk-over-time.service";
import { AccessSecurityTasksService } from "../services/abstractions/access-security-tasks.service";

import { emptyTrendData } from "./story-fixtures";

/**
 * Creates an I18nMockService pre-loaded with all keys used across Access Intelligence storybooks.
 * Use this in moduleMetadata providers instead of defining keys per-story.
 */
export function createAccessIntelligenceI18nMock(): I18nMockService {
  return new I18nMockService({
    // --- Shared ---
    loading: "Loading",
    progressBar: "Progress bar",

    // --- Shared table / search ---
    search: "Search",
    resetSearch: "Reset search",
    searchApps: "Search apps",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    unselectAll: "Deselect all",
    select: "Select",
    selectApplication: "Select application",
    unselectApplication: "Deselect application",
    filter: "Filter",
    application: "Application",
    atRiskPasswords: "At-Risk Passwords",
    totalPasswords: "Total Passwords",
    atRiskMembers: "At-Risk Members",
    totalMembers: "Total Members",
    criticalBadge: "Critical",
    yes: "Yes",
    no: "No",
    close: "Close",
    cancel: "Cancel",
    back: "Back",

    // --- Applications toolbar ---
    critical: (n: string | undefined) => `Critical (${n})`,
    notCritical: (n: string | undefined) => `Not Critical (${n})`,
    markAppCountAsCritical: (n: string | undefined) => `Mark ${n} as Critical`,
    markAppCountAsNotCritical: (n: string | undefined) => `Unmark ${n} as Critical`,
    assignTasks: "Assign Tasks",
    allTasksAssigned: "All tasks assigned",
    downloadCSV: "Download CSV",
    noApplicationsMatchTheseFilters: "No applications match these filters",

    // --- Report loading ---
    loadingProgress: "Loading progress",
    reviewingMemberData: "Reviewing member data",
    analyzingPasswords: "Analyzing passwords",
    calculatingRisks: "Calculating risks",
    generatingReports: "Generating report",
    compilingInsightsProgress: "Compiling insights",
    reportGenerationDone: "Report generation complete",

    // --- AllActivity cards ---
    membersAtRiskCount: (n: string | undefined) => `${n} members at risk`,
    membersWithAccessToAtRiskItemsForCriticalApplications:
      "Members with access to at-risk items for critical applications",
    viewAtRiskMembers: "View at-risk members",
    criticalApplications: "Critical Applications",
    countOfCriticalApplications: (n: string | undefined) => `${n} critical application(s)`,
    countOfApplicationsAtRisk: (n: string | undefined) => `${n} application(s) at risk`,
    noCriticalApplicationsMarkedYet:
      "You haven't marked any critical applications yet. Review applications to get started.",
    onceYouMarkApplicationsCriticalTheyWillDisplayHere:
      "Once you mark applications critical they will display here",
    criticalApplicationsAreAtRisk: (n: string | undefined, total: string | undefined) =>
      `${n} of ${total} critical applications are at risk`,
    viewAtRiskApplications: "View at-risk applications",
    applicationsNeedingReview: "Applications Needing Review",
    allCaughtUp: "All caught up!",
    noNewApplicationsToReviewAtThisTime: "No new applications to review at this time",
    reviewApplications: "Review Applications",
    organizationHasItemsSavedForApplications: (n: string | undefined) =>
      `Your organization has items saved for ${n} applications`,
    reviewApplicationsToSecureItems: "Review applications to secure items",
    reviewNewApplications: "Review New Applications",
    newApplicationsWithCount: (n: string | undefined) => `${n} new application(s)`,
    newApplicationsDescription: "New applications have been detected",
    reviewNow: "Review Now",

    // --- Password change metric ---
    passwordChangeProgress: "Password Change Progress",
    assignMembersTasksToMonitorProgress: "Assign members tasks to monitor progress",
    onceYouReviewApplications:
      "Once you review applications and mark them as critical, you can assign tasks to members.",
    countOfAtRiskPasswords: (n: string | undefined) => `${n} password(s) at risk`,
    newPasswordsAtRisk: (n: string | undefined) => `${n} new password(s) at risk`,
    percentageCompleted: (n: string | undefined) => `${n}% Completed`,
    securityTasksCompleted: (completed: string | undefined, total: string | undefined) =>
      `${completed} of ${total} tasks completed`,
    passwordChangeProgressBar: "Password change progress bar",
    success: "Success",
    notifiedMembers: "Members have been notified",
    error: "Error",
    unexpectedError: "An unexpected error occurred",
    mustBeOrganizationOwnerAdmin:
      "You must be an organization owner or admin to perform this action",

    // --- Applications table row menu ---
    options: "Options",
    unmarkAsCritical: "Unmark as critical",

    // --- New applications dialog ---
    prioritizeCriticalApplications: "Prioritize Critical Applications",
    assignSecurityTasksToMembers: "Assign Security Tasks to Members",
    taskSummary: "Task Summary",
    membersWillReceiveSecurityTask:
      "Members will receive a security task to update their passwords.",
    selectCriticalAppsDescription: "Select which applications are critical to your organization.",
    reviewNewAppsDescription: "Review new applications and mark which ones are critical.",
    clickIconToMarkAppAsCritical: "Click the star icon to mark an app as critical",
    markAsCritical: "Mark as Critical",
    membersWithAtRiskPwds: "Members with at risk passwords",
    membersWithAtRiskPasswordsAndForCriticalApplications: (
      n: string | undefined,
      m: string | undefined,
    ) => `${n} Members with at risk passwords for ${m} Critical applications`,
    ofCountTotal: (n: string | undefined) => `of ${n} total`,
    sendNotifications: "Send notifications",
    criticalApplicationsAtRisk: "Critical applications at risk",

    // --- Chip filter (used by ChipFilterComponent internally) ---
    viewItemsIn: (name: string | undefined) => `View items in ${name}`,
    backTo: (name: string | undefined) => `Back to ${name}`,
    removeItem: (name: string | undefined) => `Remove ${name}`,

    // --- Dialog save results ---
    applicationReviewSaved: "Application review saved",
    newApplicationsReviewed: "New applications reviewed",
    errorSavingReviewStatus: "Error saving review status",
    pleaseTryAgain: "Please try again",

    // --- Trend widget ---
    riskOverTime: "Risk over time",
    downloadChart: "Download chart",
    applications: "Applications",
    passwords: "Passwords",
    members: "Members",
    criticalAppsAtRisk: "Critical applications at risk",
    passwordsAtRisk: "Passwords at risk",
    membersAtRisk: "Members at risk",
    allCriticalApps: "All critical applications",
    allPasswords: "All passwords",
    allMembers: "All members",
    date: "Date",
    downloadFailed: "Download failed",

    // --- Period selector ---
    timePeriod: "Time period",
    pastMonth: "Past month",
    past3Months: "Past 3 months",
    past6Months: "Past 6 months",
    pastYear: "Past year",
    allTime: "All time",
  });
}

/**
 * Mock AccessIntelligenceDataService for Storybook stories.
 * Uses private subjects exposed via asObservable() per team standards.
 */
export class MockAccessIntelligenceDataService {
  private _report = new BehaviorSubject<AccessReportView | null>(null);
  readonly report$ = this._report.asObservable();

  private _loading = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading.asObservable();

  private _ciphers = new BehaviorSubject<CipherView[]>([]);
  readonly ciphers$ = this._ciphers.asObservable();

  constructor(initialReport: AccessReportView | null = null, isLoading = false) {
    this._report.next(initialReport);
    this._loading.next(isLoading);
  }

  markApplicationsAsCritical$ = (appNames: string[]) => {
    action("markApplicationsAsCritical$")(appNames);
    return of(undefined as void);
  };

  unmarkApplicationsAsCritical$ = (appNames: string[]) => {
    action("unmarkApplicationsAsCritical$")(appNames);
    return of(undefined as void);
  };

  markApplicationsAsReviewed$ = (appNames: string[], date?: Date) => {
    action("markApplicationsAsReviewed$")(appNames, date);
    return of(undefined as void);
  };
}

/**
 * Mock DrawerStateService for Storybook stories.
 */
export class MockDrawerStateService {
  openDrawer = action("openDrawer");
  closeDrawer = action("closeDrawer");
  readonly drawerState = signal(null);
}

/**
 * Mock AccessSecurityTasksService for Storybook stories.
 */
export class MockSecurityTasksService implements AccessSecurityTasksService {
  private _tasks = new BehaviorSubject<SecurityTask[]>([]);
  readonly tasks$ = this._tasks.asObservable();

  private _unassignedCipherIds = new BehaviorSubject<string[]>([]);
  readonly unassignedCriticalCipherIds$ = this._unassignedCipherIds.asObservable();

  constructor(tasks: SecurityTask[] = [], unassignedCipherIds: string[] = []) {
    this._tasks.next(tasks);
    this._unassignedCipherIds.next(unassignedCipherIds);
  }

  loadTasks$ = (_orgId: OrganizationId) => of(undefined as void);

  requestPasswordChangeForCriticalApplications$ = (orgId: OrganizationId, cipherIds: string[]) => {
    action("requestPasswordChangeForCriticalApplications$")(orgId, cipherIds);
    return of(undefined as void);
  };

  getTaskMetrics$ = (_orgId: OrganizationId) =>
    new BehaviorSubject<TaskMetrics>({ completedTasks: 0, totalTasks: 0 }).asObservable();
}

/**
 * Mock FileDownloadService for Storybook stories.
 */
export class MockFileDownloadService {
  download = action("FileDownloadService.download");
}

/**
 * Mock LogService for Storybook stories.
 */
export class MockLogService {
  error = action("LogService.error");
}

/**
 * Mock ToastService for Storybook stories.
 */
export class MockToastService {
  showToast = action("ToastService.showToast");
}

/**
 * Mock DialogService for Storybook stories.
 */
export class MockDialogService {
  open = (...args: any[]) => {
    action("DialogService.open")(...args);
    return { closed: EMPTY };
  };
  openSimpleDialog = () => Promise.resolve(true);
}

export class MockAccessIntelligenceCoachmarkService {
  readonly activeStepId = signal<AccessIntelligenceCoachmarkStepId | null>(null);
}
/**
 * Mock ConfigService for Storybook stories.
 */
export class MockConfigService {
  getFeatureFlag$ = (flag: string) => {
    action("ConfigService.getFeatureFlag$")(flag);
    return of(true);
  };
}

/**
 * Builds the theming, file-download, and chart-export providers that the
 * rendered {@link TrendWidgetComponent} (and its chart) require. Shared by the
 * trend widget's own stories and the activity-tab stories.
 *
 * Pass the `theme$` subject from {@link themeToolbarDecorator} to sync the chart
 * with Storybook's light/dark toolbar toggle; defaults to a fixed light theme.
 */
export function buildChartThemeProviders(
  theme$: BehaviorSubject<Theme> = new BehaviorSubject<Theme>(ThemeTypes.Light),
) {
  return [
    {
      provide: ThemeStateService,
      useValue: { selectedTheme$: theme$ },
    },
    {
      provide: SYSTEM_THEME_OBSERVABLE,
      useValue: theme$,
    },
    {
      provide: FileDownloadService,
      useClass: MockFileDownloadService,
    },
    // ChartExportService is providedIn root, so it would otherwise resolve its
    // FileDownloadService dependency from the root injector. Provide it here so
    // it resolves the module-scoped mock above instead.
    ChartExportService,
  ];
}

/**
 * Storybook decorator that syncs the given theme subject with the theme toolbar
 * global, so a rendered chart re-themes when the user toggles light/dark.
 * Pair the same subject with {@link buildChartThemeProviders}.
 */
export function themeToolbarDecorator(theme$: BehaviorSubject<Theme>) {
  return componentWrapperDecorator(
    (story) => story,
    ({ globals }) => {
      theme$.next(globals["theme"] === "dark" ? ThemeTypes.Dark : ThemeTypes.Light);
      return {};
    },
  );
}

export type TrendMockOptions = {
  flagEnabled?: boolean;
  data?: TrendWidgetData;
  loading?: boolean;
  error?: string | null;
};

/**
 * Builds the providers that drive the activity-tab trend chart in Storybook
 * stories: the ConfigService feature flag, the RiskOverTimeService data source,
 * and the theming + chart dependencies the rendered {@link TrendWidgetComponent}
 * needs (via {@link buildChartThemeProviders}).
 */
export function buildTrendChartProviders({
  flagEnabled = false,
  data = emptyTrendData,
  loading = false,
  error = null,
}: TrendMockOptions = {}) {
  return [
    {
      provide: ConfigService,
      useValue: {
        getFeatureFlag$: () => of(flagEnabled),
      },
    },
    {
      provide: RiskOverTimeService,
      useValue: {
        riskOverTimeData$: new BehaviorSubject<TrendWidgetData>(data),
        isLoading$: new BehaviorSubject<boolean>(loading),
        error$: new BehaviorSubject<string | null>(error),
        initialize: () => {},
        setTimeframe: () => {},
        setDataView: () => {},
      },
    },
    ...buildChartThemeProviders(),
  ];
}

export type ActivityTabMockOptions = {
  /** Drives the data service loading state (used by the loading story). */
  loading?: boolean;
  /** Trend chart feature flag + data; see {@link buildTrendChartProviders}. */
  trend?: TrendMockOptions;
};

/**
 * Builds the full provider set for an activity-tab Storybook story: the data,
 * drawer, security-tasks, and dialog mocks plus the trend chart providers.
 * Pass the report to surface (or `null` with `{ loading: true }`).
 */
export function buildActivityTabProviders(
  report: AccessReportView | null,
  { loading = false, trend }: ActivityTabMockOptions = {},
) {
  return [
    {
      provide: AccessIntelligenceDataService,
      useValue: new MockAccessIntelligenceDataService(report, loading),
    },
    { provide: DrawerStateService, useClass: MockDrawerStateService },
    { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
    { provide: DialogService, useClass: MockDialogService },
    ...buildTrendChartProviders(trend),
  ];
}

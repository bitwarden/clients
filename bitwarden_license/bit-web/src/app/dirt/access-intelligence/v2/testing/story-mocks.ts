import { signal } from "@angular/core";
import { BehaviorSubject, EMPTY, of } from "rxjs";
import { action } from "storybook/actions";

import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { TaskMetrics } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTask } from "@bitwarden/common/vault/tasks";
import { I18nMockService } from "@bitwarden/components";

import { AccessSecurityTasksService } from "../services/abstractions/access-security-tasks.service";

/**
 * Creates an I18nMockService pre-loaded with all keys used across Access Intelligence storybooks.
 * Use this in moduleMetadata providers instead of defining keys per-story.
 */
export function createAccessIntelligenceI18nMock(): I18nMockService {
  return new I18nMockService({
    // --- Shared ---
    loading: "Loading",

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
    all: "All",

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

    // --- New applications dialog ---
    prioritizeCriticalApplications: "Prioritize Critical Applications",
    assignSecurityTasksToMembers: "Assign Security Tasks to Members",
    taskSummary: "Task Summary",
    membersWithAtRiskPasswords: "members have at-risk passwords",
    membersWillReceiveSecurityTask:
      "Members will receive a security task to update their passwords.",
    selectCriticalAppsDescription: "Select which applications are critical to your organization.",
    reviewNewAppsDescription: "Review new applications and mark which ones are critical.",
    clickIconToMarkAppAsCritical: "Click the star icon to mark an app as critical",
    markAsCritical: "Mark as Critical",

    // --- Chip filter (used by ChipFilterComponent internally) ---
    viewItemsIn: (name: string | undefined) => `View items in ${name}`,
    backTo: (name: string | undefined) => `Back to ${name}`,
    removeItem: (name: string | undefined) => `Remove ${name}`,

    // --- Dialog save results ---
    applicationReviewSaved: "Application review saved",
    newApplicationsReviewed: "New applications reviewed",
    errorSavingReviewStatus: "Error saving review status",
    pleaseTryAgain: "Please try again",
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

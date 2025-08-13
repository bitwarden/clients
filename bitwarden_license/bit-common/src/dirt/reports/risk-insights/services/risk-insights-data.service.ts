import { BehaviorSubject, firstValueFrom, from, Observable, of } from "rxjs";
import {
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  map,
  switchMap,
  tap,
  withLatestFrom,
} from "rxjs/operators";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import {
  DrawerDetails,
  AppAtRiskMembersDialogParams,
  ApplicationHealthReportDetail,
  AtRiskApplicationDetail,
  AtRiskMemberDetail,
  DrawerType,
  ApplicationHealthReportDetailEnriched,
  ReportDetailsAndSummary,
} from "../models/report-models";

import { CriticalAppsService } from "./critical-apps.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";

/**
 * Service for managing risk insights data, including applications and critical applications.
 * Handles logic for drawer management and data fetching.
 */
export class RiskInsightsDataService {
  // Current user viewing risk insights
  private userIdSubject = new BehaviorSubject<UserId | null>(null);
  userId$ = this.userIdSubject.asObservable();

  // Organization the user is currently viewing
  private organizationDetailsSubject = new BehaviorSubject<{
    organizationId: OrganizationId;
    organizationName: string;
  } | null>(null);
  organizationDetails$ = this.organizationDetailsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  criticalApps$ = this.criticalAppsService.criticalAppsList$;

  // ------------------------- Drawer Variables ----------------
  // Drawer variables
  private drawerDetailsSubject = new BehaviorSubject<DrawerDetails>({
    open: false,
    invokerId: "",
    activeDrawerType: DrawerType.None,
    atRiskMemberDetails: [],
    appAtRiskMembers: null,
    atRiskAppDetails: null,
  });
  drawerDetails$ = this.drawerDetailsSubject.asObservable();

  // ------------------------- Report Variables ----------------
  // The last run report details
  private reportResultsSubject = new BehaviorSubject<ReportDetailsAndSummary | null>(null);
  reportResults$ = this.reportResultsSubject.asObservable();
  // Is a report being generated
  private isRunningReportSubject = new BehaviorSubject<boolean>(false);
  isRunningReport$ = this.isRunningReportSubject.asObservable();
  // The error from report generation if there was an error
  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  constructor(
    private accountService: AccountService,
    private criticalAppsService: CriticalAppsService,
    private organizationService: OrganizationService,
    private reportService: RiskInsightsReportService,
  ) {}

  async initialize(organizationId: OrganizationId) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (userId) {
      this.userIdSubject.next(userId);
    }

    // Fetch organization details
    const org = await firstValueFrom(
      this.organizationService.organizations$(userId).pipe(getOrganizationById(organizationId)),
    );
    if (org) {
      this.organizationDetailsSubject.next({
        organizationId: organizationId,
        organizationName: org.name,
      });
    }

    // Load critical applications
    await this.criticalAppsService.initialize(organizationId);

    // Load existing report
    this.fetchLastReport(organizationId, userId);

    // Setup new report generation
    this._runApplicationsReport().subscribe({
      next: (result) => {
        this.isRunningReportSubject.next(false);
      },
      error: () => {
        this.errorSubject.next("Failed to save report");
      },
    });
  }

  filterReportByCritical(
    report$: Observable<ReportDetailsAndSummary>,
  ): Observable<ReportDetailsAndSummary> {
    return report$.pipe(
      filter((report) => !!report),
      map((r) => ({
        ...r,
        data: r.data.filter((application) => application.isMarkedAsCritical),
      })),
    );
  }

  generateCriticalDetails$(
    report$: Observable<ReportDetailsAndSummary>,
  ): Observable<ReportDetailsAndSummary> {
    return this.filterReportByCritical(report$);
  }

  enrichWithCriticalMarking$(
    applications: ApplicationHealthReportDetail[],
  ): Observable<ApplicationHealthReportDetailEnriched[]> {
    return this.criticalAppsService.criticalAppsList$.pipe(
      map((criticalApps) => {
        const criticalApplicationNames = new Set(criticalApps.map((ca) => ca.uri));
        return applications.map((app) => ({
          ...app,
          isMarkedAsCritical: criticalApplicationNames.has(app.applicationName),
        })) as ApplicationHealthReportDetailEnriched[];
      }),
    );
  }

  enrichReportData$(
    applications: ApplicationHealthReportDetail[],
  ): Observable<ApplicationHealthReportDetailEnriched[]> {
    return of(applications).pipe(
      withLatestFrom(this.organizationDetails$, this.criticalAppsService.criticalAppsList$),
      switchMap(async ([apps, orgDetails, criticalApps]) => {
        // Get ciphers for application
        const cipherMap = await this.reportService.getApplicationCipherMap(
          apps,
          orgDetails.organizationId,
        );

        // Find critical apps
        const criticalApplicationNames = new Set(criticalApps.map((ca) => ca.uri));

        // Update application to be enriched type
        return apps.map((app) => ({
          ...app,
          ciphers: cipherMap.get(app.applicationName) || [],
          isMarkedAsCritical: criticalApplicationNames.has(app.applicationName),
        })) as ApplicationHealthReportDetailEnriched[];
      }),
    );
  }

  getCriticalReport$(report$: Observable<ReportDetailsAndSummary>) {
    const filteredReports$ = this.filterReportByCritical(report$);
    return this.generateCriticalDetails$(filteredReports$);
  }

  /**
   * Fetches the applications report and updates the applicationsSubject.
   * @param organizationId The ID of the organization.
   */
  fetchLastReport(organizationId: OrganizationId, userId: UserId): void {
    this.isLoadingSubject.next(true);

    this.reportService
      .getRiskInsightsReport$(organizationId, userId)
      .pipe(
        switchMap((report) => {
          return this.enrichReportData$(report.data).pipe(
            map((enrichedReport) => ({
              data: enrichedReport,
              summary: report.summary,
            })),
          );
        }),
        finalize(() => {
          this.isLoadingSubject.next(false);
        }),
      )
      .subscribe({
        next: ({ data, summary }) => {
          this.reportResultsSubject.next({
            data,
            summary,
            dateCreated: new Date(),
          });
          this.errorSubject.next(null);
          this.isLoadingSubject.next(false);
        },
        error: () => {
          this.errorSubject.next("Failed to fetch report");
          this.reportResultsSubject.next(null);
          this.isLoadingSubject.next(false);
        },
      });
  }

  /** Trigger generating a report based on the current applications */
  triggerReport(): void {
    this.isRunningReportSubject.next(true);
  }

  private _runApplicationsReport() {
    return this.isRunningReport$.pipe(
      distinctUntilChanged(),
      filter((isRunning) => isRunning),
      withLatestFrom(this.organizationDetails$, this.userId$),
      exhaustMap(([_, { organizationId }, userId]) => {
        if (!organizationId || !userId) {
          return;
        }

        // Generate the report
        return this.reportService.generateApplicationsReport$(organizationId).pipe(
          map((data) => ({
            data,
            summary: this.reportService.generateApplicationsSummary(data),
          })),
          switchMap(({ data, summary }) =>
            this.enrichReportData$(data).pipe(
              map((enrichedData) => ({ data: enrichedData, summary })),
            ),
          ),
          tap(({ data, summary }) => {
            this.reportResultsSubject.next({ data, summary, dateCreated: new Date() });
            this.errorSubject.next(null);
          }),
          switchMap(({ data, summary }) => {
            // Just returns ID
            return this.reportService.saveReport$(data, summary, { organizationId, userId });
          }),
        );
      }),
    );
  }

  // ------------------------- Drawer functions -----------------------------

  isActiveDrawerType$ = (drawerType: DrawerType): Observable<boolean> => {
    return this.drawerDetails$.pipe(map((details) => details.activeDrawerType === drawerType));
  };
  isActiveDrawerType = (drawerType: DrawerType): Observable<boolean> => {
    return this.drawerDetails$.pipe(map((details) => details.activeDrawerType === drawerType));
  };

  isDrawerOpenForInvoker$ = (applicationName: string) => {
    return this.drawerDetails$.pipe(map((details) => details.invokerId === applicationName));
  };
  isDrawerOpenForInvoker = (applicationName: string) => {
    return this.drawerDetails$.pipe(map((details) => details.invokerId === applicationName));
  };

  closeDrawer = (): void => {
    this.drawerDetailsSubject.next({
      open: false,
      invokerId: "",
      activeDrawerType: DrawerType.None,
      atRiskMemberDetails: [],
      appAtRiskMembers: null,
      atRiskAppDetails: null,
    });
  };

  setDrawerForOrgAtRiskMembers = (
    atRiskMemberDetails: AtRiskMemberDetail[],
    invokerId: string = "",
  ): void => {
    this.drawerDetailsSubject.next({
      open: true,
      invokerId,
      activeDrawerType: DrawerType.OrgAtRiskMembers,
      atRiskMemberDetails,
      appAtRiskMembers: null,
      atRiskAppDetails: null,
    });
  };

  setDrawerForAppAtRiskMembers = (
    atRiskMembersDialogParams: AppAtRiskMembersDialogParams,
    invokerId: string = "",
  ): void => {
    this.drawerDetailsSubject.next({
      open: true,
      invokerId,
      activeDrawerType: DrawerType.AppAtRiskMembers,
      atRiskMemberDetails: [],
      appAtRiskMembers: atRiskMembersDialogParams,
      atRiskAppDetails: null,
    });
  };

  setDrawerForOrgAtRiskApps = (
    atRiskApps: AtRiskApplicationDetail[],
    invokerId: string = "",
  ): void => {
    this.drawerDetailsSubject.next({
      open: true,
      invokerId,
      activeDrawerType: DrawerType.OrgAtRiskApps,
      atRiskMemberDetails: [],
      appAtRiskMembers: null,
      atRiskAppDetails: atRiskApps,
    });
  };

  // ------------------------- Critical Application functions -----------------------------
  /**
   * Calls the critical apps service with the organization and selected applications
   */
  saveCriticalApps = (applications: string[]) =>
    this.organizationDetails$.pipe(
      exhaustMap(({ organizationId }) => {
        return from(this.criticalAppsService.setCriticalApps(organizationId, applications));
      }),
    );

  /**
   * Removes a specified application from the organization's list of critical applications
   *
   * @param applicationName
   * @returns
   */
  dropCriticalApp(applicationName: string) {
    return of(applicationName).pipe(
      withLatestFrom(this.organizationDetails$),
      exhaustMap(async ([hostname, { organizationId }]) => {
        const result = await this.criticalAppsService.dropCriticalApp(organizationId, hostname);
        return result;
      }),
    );
  }
}

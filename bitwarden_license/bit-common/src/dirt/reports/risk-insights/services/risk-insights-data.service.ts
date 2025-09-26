import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";
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
  AppAtRiskMembersDialogParams,
  AtRiskApplicationDetail,
  AtRiskMemberDetail,
  DrawerType,
  DrawerDetails,
  ApplicationHealthReportDetail,
  ApplicationHealthReportDetailEnriched,
  ReportDetailsAndSummary,
} from "../models/report-models";

import { CriticalAppsService } from "./critical-apps.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";
export class RiskInsightsDataService {
  // -------------------------- Context state --------------------------
  // Current user viewing risk insights
  private userIdSubject = new BehaviorSubject<UserId | null>(null);
  userId$ = this.userIdSubject.asObservable();

  // Organization the user is currently viewing
  private organizationDetailsSubject = new BehaviorSubject<{
    organizationId: OrganizationId;
    organizationName: string;
  } | null>(null);
  organizationDetails$ = this.organizationDetailsSubject.asObservable();

  // -------------------------- Data ------------------------------------
  private applicationsSubject = new BehaviorSubject<ApplicationHealthReportDetail[] | null>(null);
  applications$ = this.applicationsSubject.asObservable();

  private dataLastUpdatedSubject = new BehaviorSubject<Date | null>(null);
  dataLastUpdated$ = this.dataLastUpdatedSubject.asObservable();

  criticalApps$ = this.criticalAppsService.criticalAppsList$;

  // --------------------------- UI State ------------------------------------

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private isRefreshingSubject = new BehaviorSubject<boolean>(false);
  isRefreshing$ = this.isRefreshingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  // ------------------------- Drawer Variables ----------------
  // Drawer variables unified into a single BehaviorSubject
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

  constructor(
    private accountService: AccountService,
    private criticalAppsService: CriticalAppsService,
    private organizationService: OrganizationService,
    private reportService: RiskInsightsReportService,
  ) {}

  // [FIXME] PM-25612 - Call Initialization in RiskInsightsComponent instead of child components
  async initializeForOrganization(organizationId: OrganizationId) {
    // Fetch current user
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (userId) {
      this.userIdSubject.next(userId);
    }

    // [FIXME] getOrganizationById is now deprecated - replace with appropriate method
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

    // Load critical applications for organization
    await this.criticalAppsService.loadOrganizationContext(organizationId, userId);

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

  /**
   * Fetches the applications report and updates the applicationsSubject.
   * @param organizationId The ID of the organization.
   */
  fetchApplicationsReport(organizationId: OrganizationId, isRefresh?: boolean): void {
    if (isRefresh) {
      this.isRefreshingSubject.next(true);
    } else {
      this.isLoadingSubject.next(true);
    }
    this.reportService
      .LEGACY_generateApplicationsReport$(organizationId)
      .pipe(
        finalize(() => {
          this.isLoadingSubject.next(false);
          this.isRefreshingSubject.next(false);
          this.dataLastUpdatedSubject.next(new Date());
        }),
      )
      .subscribe({
        next: (reports: ApplicationHealthReportDetail[]) => {
          this.applicationsSubject.next(reports);
          this.errorSubject.next(null);
        },
        error: () => {
          this.applicationsSubject.next([]);
        },
      });
  }

  refreshApplicationsReport(organizationId: OrganizationId): void {
    this.fetchApplicationsReport(organizationId, true);
  }

  // ------------------------------- Enrichment methods -------------------------------
  /**
   * Takes the basic application health report details and enriches them to include
   * critical app status and associated ciphers.
   *
   * @param applications The list of application health report details to enrich
   * @returns The enriched application health report details with critical app status and ciphers
   */
  enrichReportData$(
    applications: ApplicationHealthReportDetail[],
  ): Observable<ApplicationHealthReportDetailEnriched[]> {
    return of(applications).pipe(
      withLatestFrom(this.organizationDetails$, this.criticalApps$),
      switchMap(async ([apps, orgDetails, criticalApps]) => {
        if (!orgDetails) {
          return [];
        }

        // Get ciphers for application
        const cipherMap = await this.reportService.getApplicationCipherMap(
          apps,
          orgDetails.organizationId,
        );

        // Find critical apps
        const criticalApplicationNames = new Set(criticalApps.map((ca) => ca.uri));

        // Return enriched application data
        return apps.map((app) => ({
          ...app,
          ciphers: cipherMap.get(app.applicationName) || [],
          isMarkedAsCritical: criticalApplicationNames.has(app.applicationName),
        })) as ApplicationHealthReportDetailEnriched[];
      }),
    );
  }

  // ------------------------------- Drawer management methods -------------------------------
  // ------------------------- Drawer functions -----------------------------

  isActiveDrawerType$ = (drawerType: DrawerType): Observable<boolean> => {
    return this.drawerDetails$.pipe(map((details) => details.activeDrawerType === drawerType));
  };
  isActiveDrawerType = (drawerType: DrawerType): boolean => {
    return this.drawerDetailsSubject.value.activeDrawerType === drawerType;
  };

  isDrawerOpenForInvoker$ = (applicationName: string) => {
    return this.drawerDetails$.pipe(map((details) => details.invokerId === applicationName));
  };
  isDrawerOpenForInvoker = (applicationName: string): boolean => {
    return this.drawerDetailsSubject.value.invokerId === applicationName;
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
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.OrgAtRiskMembers && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      this.drawerDetailsSubject.next({
        open: true,
        invokerId,
        activeDrawerType: DrawerType.OrgAtRiskMembers,
        atRiskMemberDetails,
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      });
    }
  };

  setDrawerForAppAtRiskMembers = (
    atRiskMembersDialogParams: AppAtRiskMembersDialogParams,
    invokerId: string = "",
  ): void => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.AppAtRiskMembers && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      this.drawerDetailsSubject.next({
        open: true,
        invokerId,
        activeDrawerType: DrawerType.AppAtRiskMembers,
        atRiskMemberDetails: [],
        appAtRiskMembers: atRiskMembersDialogParams,
        atRiskAppDetails: null,
      });
    }
  };

  setDrawerForOrgAtRiskApps = (
    atRiskApps: AtRiskApplicationDetail[],
    invokerId: string = "",
  ): void => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.OrgAtRiskApps && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      this.drawerDetailsSubject.next({
        open: true,
        invokerId,
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: atRiskApps,
      });
    }
  };

  // ------------------- Trigger Report Generation -------------------
  /** Trigger generating a report based on the current applications */
  triggerReport(): void {
    this.isRunningReportSubject.next(true);
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
            return this.reportService.saveRiskInsightsReport$(data, summary, {
              organizationId,
              userId,
            });
          }),
        );
      }),
    );
  }
}

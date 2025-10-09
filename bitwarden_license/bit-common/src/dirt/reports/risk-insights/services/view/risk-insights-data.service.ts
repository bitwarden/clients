import { BehaviorSubject, EMPTY, firstValueFrom, Observable, of, throwError } from "rxjs";
import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  map,
  shareReplay,
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

import { ApplicationHealthReportDetailEnriched } from "../../models";
import { RiskInsightsEnrichedData } from "../../models/report-data-service.types";
import {
  DrawerType,
  DrawerDetails,
  ApplicationHealthReportDetail,
} from "../../models/report-models";
import { CriticalAppsService } from "../domain/critical-apps.service";
import { RiskInsightsReportService } from "../domain/risk-insights-report.service";

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
  private reportResultsSubject = new BehaviorSubject<RiskInsightsEnrichedData | null>(null);
  reportResults$ = this.reportResultsSubject.asObservable();
  // Is a report being generated
  private isRunningReportSubject = new BehaviorSubject<boolean>(false);
  isRunningReport$ = this.isRunningReportSubject.asObservable();

  // --------------------------- Critical Application data ---------------------
  criticalReportResults$: Observable<RiskInsightsEnrichedData | null> = of(null);

  constructor(
    private accountService: AccountService,
    private criticalAppsService: CriticalAppsService,
    private organizationService: OrganizationService,
    private reportService: RiskInsightsReportService,
  ) {
    // Reload report if critical applications change
    // This also handles the original report load
    this.criticalAppsService.criticalAppsList$
      .pipe(withLatestFrom(this.organizationDetails$, this.userId$))
      .subscribe({
        next: ([_criticalApps, organizationDetails, userId]) => {
          if (organizationDetails?.organizationId && userId) {
            this.fetchLastReport(organizationDetails?.organizationId, userId);
          }
        },
      });

    // Setup critical application data and summary generation for live critical application usage
    this.criticalReportResults$ = this.reportResults$.pipe(
      filter((report) => !!report),
      map((r) => {
        const criticalApplications = r.reportData.filter(
          (application) => application.isMarkedAsCritical,
        );
        const summary = this.reportService.generateApplicationsSummary(criticalApplications);

        return {
          ...r,
          summaryData: summary,
          reportData: criticalApplications,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

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
    // TODO Compare applications on report to updated critical applications
    // TODO Compare applications on report to any new applications
    return of(applications).pipe(
      withLatestFrom(this.organizationDetails$, this.criticalAppsService.criticalAppsList$),
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

  // ------------------------- Drawer functions -----------------------------
  isActiveDrawerType = (drawerType: DrawerType): boolean => {
    return this.drawerDetailsSubject.value.activeDrawerType === drawerType;
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

  setDrawerForOrgAtRiskMembers = async (invokerId: string = ""): Promise<void> => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.OrgAtRiskMembers && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      const reportResults = await firstValueFrom(this.reportResults$);
      if (!reportResults) {
        return;
      }

      const atRiskMemberDetails = this.reportService.generateAtRiskMemberList(
        reportResults.reportData,
      );

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

  setDrawerForAppAtRiskMembers = async (invokerId: string = ""): Promise<void> => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.AppAtRiskMembers && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      const reportResults = await firstValueFrom(this.reportResults$);
      if (!reportResults) {
        return;
      }

      const atRiskMembers = {
        members:
          reportResults.reportData.find((app) => app.applicationName === invokerId)
            ?.atRiskMemberDetails ?? [],
        applicationName: invokerId,
      };
      this.drawerDetailsSubject.next({
        open: true,
        invokerId,
        activeDrawerType: DrawerType.AppAtRiskMembers,
        atRiskMemberDetails: [],
        appAtRiskMembers: atRiskMembers,
        atRiskAppDetails: null,
      });
    }
  };

  setDrawerForOrgAtRiskApps = async (invokerId: string = ""): Promise<void> => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.OrgAtRiskApps && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      const reportResults = await firstValueFrom(this.reportResults$);
      if (!reportResults) {
        return;
      }
      const atRiskAppDetails = this.reportService.generateAtRiskApplicationList(
        reportResults.reportData,
      );

      this.drawerDetailsSubject.next({
        open: true,
        invokerId,
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails,
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
          // Take fetched report data and merge with critical applications
          return this.enrichReportData$(report.reportData).pipe(
            map((enrichedReport) => ({
              report: enrichedReport,
              summary: report.summaryData,
              applications: report.applicationData,
              creationDate: report.creationDate,
            })),
          );
        }),
        catchError((error: unknown) => {
          // console.error("An error occurred when fetching the last report", error);
          return EMPTY;
        }),
        finalize(() => {
          this.isLoadingSubject.next(false);
        }),
      )
      .subscribe({
        next: ({ report, summary, applications, creationDate }) => {
          this.reportResultsSubject.next({
            reportData: report,
            summaryData: summary,
            applicationData: applications,
            creationDate: creationDate,
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
      // Only run this report if the flag for running is true
      filter((isRunning) => isRunning),
      withLatestFrom(this.organizationDetails$, this.userId$),
      exhaustMap(([_, organizationDetails, userId]) => {
        const organizationId = organizationDetails?.organizationId;
        if (!organizationId || !userId) {
          return EMPTY;
        }

        // Generate the report
        return this.reportService.generateApplicationsReport$(organizationId).pipe(
          map((report) => ({
            report,
            summary: this.reportService.generateApplicationsSummary(report),
            applications: this.reportService.generateOrganizationApplications(report),
          })),
          // Enrich report with critical markings
          switchMap(({ report, summary, applications }) =>
            this.enrichReportData$(report).pipe(
              map((enrichedReport) => ({ report: enrichedReport, summary, applications })),
            ),
          ),
          // Load the updated data into the UI
          tap(({ report, summary, applications }) => {
            this.reportResultsSubject.next({
              reportData: report,
              summaryData: summary,
              applicationData: applications,
              creationDate: new Date(),
            });
            this.errorSubject.next(null);
          }),
          switchMap(({ report, summary, applications }) => {
            // Save the generated data
            return this.reportService.saveRiskInsightsReport$(report, summary, applications, {
              organizationId,
              userId,
            });
          }),
        );
      }),
    );
  }

  // ------------------------------ Critical application methods --------------

  saveCriticalApplications(selectedUrls: string[]) {
    return this.organizationDetails$.pipe(
      exhaustMap((organizationDetails) => {
        if (!organizationDetails?.organizationId) {
          return EMPTY;
        }
        return this.criticalAppsService.setCriticalApps(
          organizationDetails?.organizationId,
          selectedUrls,
        );
      }),
      catchError((error: unknown) => {
        this.errorSubject.next("Failed to save critical applications");
        return throwError(() => error);
      }),
    );
  }

  removeCriticalApplication(hostname: string) {
    return this.organizationDetails$.pipe(
      exhaustMap((organizationDetails) => {
        if (!organizationDetails?.organizationId) {
          return EMPTY;
        }
        return this.criticalAppsService.dropCriticalApp(
          organizationDetails?.organizationId,
          hostname,
        );
      }),
      catchError((error: unknown) => {
        this.errorSubject.next("Failed to remove critical application");
        return throwError(() => error);
      }),
    );
  }
}

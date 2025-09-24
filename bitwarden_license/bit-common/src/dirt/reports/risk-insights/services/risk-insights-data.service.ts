import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";
import { finalize, switchMap, withLatestFrom } from "rxjs/operators";

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
  ApplicationHealthReportDetail,
  ApplicationHealthReportDetailEnriched,
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

  openDrawer = false;
  drawerInvokerId: string = "";
  activeDrawerType: DrawerType = DrawerType.None;
  atRiskMemberDetails: AtRiskMemberDetail[] = [];
  appAtRiskMembers: AppAtRiskMembersDialogParams | null = null;
  atRiskAppDetails: AtRiskApplicationDetail[] | null = null;

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

    // [FIXME] getOrganizationById is now deprecated - update when we can
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

    // TODO: PM-25613
    // // Load existing report

    // this.fetchLastReport(organizationId, userId);

    // // Setup new report generation
    // this._runApplicationsReport().subscribe({
    //   next: (result) => {
    //     this.isRunningReportSubject.next(false);
    //   },
    //   error: () => {
    //     this.errorSubject.next("Failed to save report");
    //   },
    // });
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
  isActiveDrawerType = (drawerType: DrawerType): boolean => {
    return this.activeDrawerType === drawerType;
  };

  setDrawerForOrgAtRiskMembers = (
    atRiskMemberDetails: AtRiskMemberDetail[],
    invokerId: string = "",
  ): void => {
    this.resetDrawer(DrawerType.OrgAtRiskMembers);
    this.activeDrawerType = DrawerType.OrgAtRiskMembers;
    this.drawerInvokerId = invokerId;
    this.atRiskMemberDetails = atRiskMemberDetails;
    this.openDrawer = !this.openDrawer;
  };

  setDrawerForAppAtRiskMembers = (
    atRiskMembersDialogParams: AppAtRiskMembersDialogParams,
    invokerId: string = "",
  ): void => {
    this.resetDrawer(DrawerType.None);
    this.activeDrawerType = DrawerType.AppAtRiskMembers;
    this.drawerInvokerId = invokerId;
    this.appAtRiskMembers = atRiskMembersDialogParams;
    this.openDrawer = !this.openDrawer;
  };

  setDrawerForOrgAtRiskApps = (
    atRiskApps: AtRiskApplicationDetail[],
    invokerId: string = "",
  ): void => {
    this.resetDrawer(DrawerType.OrgAtRiskApps);
    this.activeDrawerType = DrawerType.OrgAtRiskApps;
    this.drawerInvokerId = invokerId;
    this.atRiskAppDetails = atRiskApps;
    this.openDrawer = !this.openDrawer;
  };

  closeDrawer = (): void => {
    this.resetDrawer(DrawerType.None);
  };

  private resetDrawer = (drawerType: DrawerType): void => {
    if (this.activeDrawerType !== drawerType) {
      this.openDrawer = false;
    }

    this.activeDrawerType = DrawerType.None;
    this.atRiskMemberDetails = [];
    this.appAtRiskMembers = null;
    this.atRiskAppDetails = null;
    this.drawerInvokerId = "";
  };
}

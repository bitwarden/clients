import { BehaviorSubject, Observable } from "rxjs";
import { finalize, map } from "rxjs/operators";

import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AppAtRiskMembersDialogParams,
  AtRiskApplicationDetail,
  AtRiskMemberDetail,
  DrawerType,
  DrawerDetails,
  ApplicationHealthReportDetail,
} from "../models/report-models";

import { RiskInsightsReportService } from "./risk-insights-report.service";
export class RiskInsightsDataService {
  private applicationsSubject = new BehaviorSubject<ApplicationHealthReportDetail[] | null>(null);

  applications$ = this.applicationsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private isRefreshingSubject = new BehaviorSubject<boolean>(false);
  isRefreshing$ = this.isRefreshingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  private dataLastUpdatedSubject = new BehaviorSubject<Date | null>(null);
  dataLastUpdated$ = this.dataLastUpdatedSubject.asObservable();

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

  constructor(private reportService: RiskInsightsReportService) {}

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
}

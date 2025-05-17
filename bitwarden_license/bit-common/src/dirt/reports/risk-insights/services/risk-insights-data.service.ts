import { BehaviorSubject } from "rxjs";
import { finalize, switchMap } from "rxjs/operators";

import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AppAtRiskMembersDialogParams,
  ApplicationHealthReportDetail,
  ApplicationHealthReportSummary,
  AtRiskApplicationDetail,
  AtRiskMemberDetail,
  DrawerType,
} from "../models/password-health";

import { RiskInsightsApiService } from "./risk-insights-api.service";
import { RiskInsightsReportService } from "./risk-insights-report.service";
export class RiskInsightsDataService {
  private applicationsSubject = new BehaviorSubject<ApplicationHealthReportDetail[] | null>(null);
  private appsSummarySubject = new BehaviorSubject<ApplicationHealthReportSummary | null>(null);
  private isReportFromArchiveSubject = new BehaviorSubject<boolean>(true); // True by default

  applications$ = this.applicationsSubject.asObservable();
  appsSummary$ = this.appsSummarySubject.asObservable();
  isReportFromArchive$ = this.isReportFromArchiveSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private isRefreshingSubject = new BehaviorSubject<boolean>(false);
  isRefreshing$ = this.isRefreshingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  private dataLastUpdatedSubject = new BehaviorSubject<Date | null>(null);
  dataLastUpdated$ = this.dataLastUpdatedSubject.asObservable();

  openDrawer = false;
  drawerInvokerId: string = "";
  activeDrawerType: DrawerType = DrawerType.None;
  atRiskMemberDetails: AtRiskMemberDetail[] = [];
  appAtRiskMembers: AppAtRiskMembersDialogParams | null = null;
  atRiskAppDetails: AtRiskApplicationDetail[] | null = null;

  constructor(
    private reportService: RiskInsightsReportService,
    private riskInsightsApiService: RiskInsightsApiService,
  ) {}

  /**
   * Fetches the applications report and updates the applicationsSubject.
   * @param organizationId The ID of the organization.
   */
  fetchApplicationsReport(organizationId: string, isRefresh?: boolean): void {
    if (isRefresh) {
      this.isRefreshingSubject.next(true);
    } else {
      this.isLoadingSubject.next(true);
    }
    this.reportService
      .generateApplicationsReport$(organizationId)
      .pipe(
        finalize(() => {
          this.isLoadingSubject.next(false);
          this.isRefreshingSubject.next(false);
        }),
      )
      .subscribe({
        next: (reports: ApplicationHealthReportDetail[]) => {
          this.applicationsSubject.next(reports);
          this.errorSubject.next(null);
          this.appsSummarySubject.next(this.reportService.generateApplicationsSummary(reports));
          this.dataLastUpdatedSubject.next(new Date());
        },
        error: () => {
          this.applicationsSubject.next([]);
        },
      });
  }

  fetchApplicationsReportFromCache(organizationId: string) {
    return this.riskInsightsApiService
      .getRiskInsightsReport(organizationId as OrganizationId)
      .pipe(
        switchMap(async (reportFromArchive) => {
          if (!reportFromArchive || !reportFromArchive?.reportDate) {
            this.fetchApplicationsReport(organizationId);

            return {
              report: [],
              summary: null,
              fromDb: false,
              lastUpdated: new Date(),
            };
          } else {
            const [report, summary] = await this.reportService.decryptRiskInsightsReport(
              organizationId as OrganizationId,
              reportFromArchive,
            );

            return {
              report,
              summary,
              fromDb: true,
              lastUpdated: new Date(reportFromArchive.reportDate),
            };
          }
        }),
      )
      .subscribe({
        next: ({ report, summary, fromDb, lastUpdated }) => {
          if (fromDb) {
            this.applicationsSubject.next(report);
            this.errorSubject.next(null);
            this.appsSummarySubject.next(summary);
          }
          this.isReportFromArchiveSubject.next(fromDb);
          this.dataLastUpdatedSubject.next(lastUpdated);
        },
        error: (error: unknown) => {
          this.errorSubject.next((error as Error).message);
          this.applicationsSubject.next([]);
        },
      });
  }

  isLoadingData(started: boolean): void {
    this.isLoadingSubject.next(started);
    this.isRefreshingSubject.next(started);
  }

  refreshApplicationsReport(organizationId: string): void {
    this.fetchApplicationsReport(organizationId, true);
  }

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

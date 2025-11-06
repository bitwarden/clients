import { BehaviorSubject, firstValueFrom, Observable, of, Subject } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { getAtRiskApplicationList, getAtRiskMemberList } from "../../helpers";
import {
  ReportState,
  DrawerDetails,
  DrawerType,
  RiskInsightsEnrichedData,
  ReportStatus,
  ApplicationHealthReportDetail,
  OrganizationReportApplication,
} from "../../models";
import { RiskInsightsOrchestratorService } from "../domain/risk-insights-orchestrator.service";

export class RiskInsightsDataService {
  private _destroy$ = new Subject<void>();

  // -------------------------- Context state --------------------------
  // Organization the user is currently viewing
  readonly organizationDetails$: Observable<{
    organizationId: OrganizationId;
    organizationName: string;
  } | null> = of(null);

  // --------------------------- UI State ------------------------------------
  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  // -------------------------- Orchestrator-driven state  -------------
  // The full report state (for internal facade use or complex components)
  private readonly reportState$: Observable<ReportState>;
  readonly reportStatus$: Observable<ReportStatus> = of(ReportStatus.Initializing);
  readonly hasReportData$: Observable<boolean> = of(false);
  readonly enrichedReportData$: Observable<RiskInsightsEnrichedData | null> = of(null);
  readonly isGeneratingReport$: Observable<boolean> = of(false);
  readonly criticalReportResults$: Observable<RiskInsightsEnrichedData | null> = of(null);
  readonly hasCiphers$: Observable<boolean | null> = of(null);

  // New applications that need review (reviewedDate === null)
  readonly newApplications$: Observable<ApplicationHealthReportDetail[]> = of([]);

  // ------------------------- Drawer Variables ---------------------
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

  // --------------------------- Critical Application data ---------------------
  constructor(private orchestrator: RiskInsightsOrchestratorService) {
    this.reportState$ = this.orchestrator.rawReportData$;
    this.isGeneratingReport$ = this.orchestrator.generatingReport$;
    this.organizationDetails$ = this.orchestrator.organizationDetails$;
    this.enrichedReportData$ = this.orchestrator.enrichedReportData$;
    this.criticalReportResults$ = this.orchestrator.criticalReportResults$;
    this.newApplications$ = this.orchestrator.newApplications$;

    this.hasCiphers$ = this.orchestrator.hasCiphers$.pipe(distinctUntilChanged());

    // Expose the loading state
    this.reportStatus$ = this.reportState$.pipe(
      map((state) => state.status),
      distinctUntilChanged(), // Prevent unnecessary component re-renders
    );
    this.hasReportData$ = this.reportState$.pipe(
      map((state) => state.data != null),
      distinctUntilChanged(),
    );
  }

  destroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // ----- UI-triggered methods (delegate to orchestrator) -----
  initializeForOrganization(organizationId: OrganizationId) {
    this.orchestrator.initializeForOrganization(organizationId);
  }

  triggerReport(): void {
    this.orchestrator.generateReport();
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
      const reportResults = await firstValueFrom(this.enrichedReportData$);
      if (!reportResults) {
        return;
      }

      const atRiskMemberDetails = getAtRiskMemberList(reportResults.reportData);

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
      const reportResults = await firstValueFrom(this.enrichedReportData$);
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
      const reportResults = await firstValueFrom(this.enrichedReportData$);
      if (!reportResults) {
        return;
      }
      const atRiskAppDetails = getAtRiskApplicationList(reportResults.reportData);

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

  setDrawerForCriticalAtRiskMembers = async (invokerId: string = ""): Promise<void> => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.OrgAtRiskMembers && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      const reportResults = await firstValueFrom(this.criticalReportResults$);
      if (!reportResults?.reportData) {
        return;
      }

      // Generate at-risk member list from critical applications
      const atRiskMemberDetails = getAtRiskMemberList(reportResults.reportData);

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

  setDrawerForCriticalAtRiskApps = async (invokerId: string = ""): Promise<void> => {
    const { open, activeDrawerType, invokerId: currentInvokerId } = this.drawerDetailsSubject.value;
    const shouldClose =
      open && activeDrawerType === DrawerType.OrgAtRiskApps && currentInvokerId === invokerId;

    if (shouldClose) {
      this.closeDrawer();
    } else {
      const reportResults = await firstValueFrom(this.criticalReportResults$);
      if (!reportResults?.reportData) {
        return;
      }

      // Filter critical applications for those with at-risk passwords
      const criticalAtRiskApps = reportResults.reportData
        .filter((app) => app.atRiskPasswordCount > 0)
        .map((app) => ({
          applicationName: app.applicationName,
          atRiskPasswordCount: app.atRiskPasswordCount,
        }));

      this.drawerDetailsSubject.next({
        open: true,
        invokerId,
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: criticalAtRiskApps,
      });
    }
  };

  // ------------------------------ Critical application methods --------------
  saveCriticalApplications(selectedUrls: string[]) {
    return this.orchestrator.saveCriticalApplications$(selectedUrls);
  }

  removeCriticalApplication(hostname: string) {
    return this.orchestrator.removeCriticalApplication$(hostname);
  }

  saveApplicationReviewStatus(selectedCriticalApps: OrganizationReportApplication[]) {
    return this.orchestrator.saveApplicationReviewStatus$(selectedCriticalApps);
  }
}

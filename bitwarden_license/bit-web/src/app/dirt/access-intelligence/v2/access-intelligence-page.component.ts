import { animate, style, transition, trigger } from "@angular/animations";
import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { toObservable, toSignal, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, distinctUntilChanged, EMPTY, map, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  MemberRegistryEntry,
  RiskInsightsView,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/view/risk-insights.view";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogRef,
  DialogService,
  TabsModule,
} from "@bitwarden/components";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { EmptyStateCardComponent } from "../empty-state-card.component";
import { RiskInsightsTabType } from "../models/risk-insights.models";
import { ReportLoadingComponent } from "../shared/report-loading.component";

import { AllActivityV2Component } from "./all-activity-v2.component";
import { ApplicationsV2Component } from "./applications-v2.component";
import {
  AppAtRiskMembersData,
  CriticalAtRiskAppsData,
  CriticalAtRiskMembersData,
  DrawerContentData,
  DrawerMemberData,
  OrgAtRiskAppsData,
  OrgAtRiskMembersData,
} from "./models/drawer-content-data.types";
import { RiskInsightsDrawerV2Component } from "./shared/risk-insights-drawer-v2.component";

@Component({
  selector: "app-access-intelligence-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./access-intelligence-page.component.html",
  imports: [
    // V2 child components
    AllActivityV2Component,
    ApplicationsV2Component,
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    EmptyStateCardComponent,
    JslibModule,
    HeaderModule,
    TabsModule,
    ReportLoadingComponent,
  ],
  animations: [
    trigger("fadeIn", [
      transition(":enter", [
        style({ opacity: 0 }),
        animate("300ms 100ms ease-in", style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class AccessIntelligencePageComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);

  /**
   * IMPORTANT: This MUST be a regular property, not a signal.
   * The bit-tab-group component's two-way binding [(selectedIndex)] requires
   * direct property assignment, which doesn't work with signals.
   */
  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllActivity;

  protected readonly organizationId = signal<OrganizationId>("" as OrganizationId);
  protected readonly appsCount = signal<number>(0);
  protected readonly dataLastUpdated = signal<Date | null>(null);

  // Convert V2 observables to signals for template
  protected readonly report = toSignal(this.accessIntelligenceService.report$);
  protected readonly loading = toSignal(
    this.accessIntelligenceService.loading$.pipe(
      skeletonLoadingDelay(1000, 1000), // Wait 1s before showing, min 1s display
    ),
  );
  protected readonly error = toSignal(this.accessIntelligenceService.error$);

  // Convert drawer state signal to observable for combineLatest (must be in injection context)
  private readonly drawerState$ = toObservable(this.drawerStateService.drawerState);

  // Empty state computed properties
  protected emptyStateBenefits: [string, string][] = [
    [this.i18nService.t("feature1Title"), this.i18nService.t("feature1Description")],
    [this.i18nService.t("feature2Title"), this.i18nService.t("feature2Description")],
    [this.i18nService.t("feature3Title"), this.i18nService.t("feature3Description")],
  ];
  protected emptyStateVideoSrc: string | null = "/videos/risk-insights-mark-as-critical.mp4";
  protected IMPORT_ICON = "bwi bwi-download";

  protected currentDialogRef: DialogRef<unknown, RiskInsightsDrawerV2Component> | null = null;

  // Computed values from report
  protected readonly hasReportData = computed(() => {
    const report = this.report();
    return report !== null && report !== undefined && report.reports.length > 0;
  });

  // CSV export column headers (i18n keys)
  private readonly csvHeaders = {
    members: {
      email: "email",
      atRiskPasswordCount: "atRiskPasswords",
    },
    applications: {
      applicationName: "application",
      atRiskPasswordCount: "atRiskPasswords",
    },
  } as const;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    protected accessIntelligenceService: AccessIntelligenceDataService,
    protected drawerStateService: DrawerStateService,
    protected i18nService: I18nService,
    protected dialogService: DialogService,
    private fileDownloadService: FileDownloadService,
    private logService: LogService,
  ) {
    // Subscribe to tab index changes from query params
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllActivity;
    });
  }

  async ngOnInit() {
    // Initialize for organization
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        tap((orgId) => {
          if (orgId) {
            this.organizationId.set(orgId as OrganizationId);
            // Initialize V2 data service
            this.accessIntelligenceService
              .initializeForOrganization$(orgId as OrganizationId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe();
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe();

    // Subscribe to report data updates
    this.accessIntelligenceService.report$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((report) => {
        this.appsCount.set(report?.reports.length ?? 0);
        this.dataLastUpdated.set(report?.creationDate ?? null);
      });

    // Setup drawer subscription for content derivation
    this.setupDrawerSubscription();

    // Close any open dialogs (happens when navigating between orgs)
    this.currentDialogRef?.close();
  }

  ngOnDestroy(): void {
    this.currentDialogRef?.close();
  }

  /**
   * Generates a new report for the current organization.
   * Triggers report generation via V2 data service.
   */
  generateReport(): void {
    const orgId = this.organizationId();
    if (orgId) {
      this.accessIntelligenceService
        .generateNewReport$(orgId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: (error: unknown) => {
            this.logService.error("Failed to generate report", error);
          },
        });
    }
  }

  async onTabChange(newIndex: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tabIndex: newIndex },
      queryParamsHandling: "merge",
    });

    // Reset drawer state and close drawer when tabs are changed
    // This ensures card selection state is cleared (PM-29263)
    this.drawerStateService.closeDrawer();
    this.currentDialogRef?.close();
  }

  // Empty state methods

  goToImportPage = () => {
    void this.router.navigate([
      "/organizations",
      this.organizationId(),
      "settings",
      "tools",
      "import",
    ]);
  };

  /**
   * Derives drawer content on-demand from report$ + drawerState.
   * V2 pattern: content computed from view model methods, not pre-stored.
   */
  private setupDrawerSubscription(): void {
    combineLatest([this.drawerState$, this.accessIntelligenceService.report$])
      .pipe(
        map(([drawerState, report]): DrawerContentData | null => {
          if (!drawerState.open || !report) {
            return null;
          }

          // Derive content based on drawer type
          switch (drawerState.type) {
            case DrawerType.AppAtRiskMembers:
              return this.getAppAtRiskMembersContent(report, drawerState.invokerId);
            case DrawerType.OrgAtRiskMembers:
              return this.getOrgAtRiskMembersContent(report);
            case DrawerType.OrgAtRiskApps:
              return this.getOrgAtRiskAppsContent(report);
            case DrawerType.CriticalAtRiskMembers:
              return this.getCriticalAtRiskMembersContent(report);
            case DrawerType.CriticalAtRiskApps:
              return this.getCriticalAtRiskAppsContent(report);
            default:
              return null;
          }
        }),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((content) => {
        if (content) {
          this.currentDialogRef = this.dialogService.openDrawer(RiskInsightsDrawerV2Component, {
            data: content,
          });
        } else {
          this.currentDialogRef?.close();
        }
      });
  }

  /**
   * Derives application-specific at-risk members drawer content.
   * Uses view model's getAtRiskMembers(registry) method.
   */
  private getAppAtRiskMembersContent(
    report: RiskInsightsView,
    applicationName: string,
  ): AppAtRiskMembersData | null {
    const app = report.getApplicationByName(applicationName);
    if (!app) {
      return null;
    }

    const members = app.getAtRiskMembers(report.memberRegistry);
    return {
      type: DrawerType.AppAtRiskMembers,
      applicationName: app.applicationName,
      members: this.mapMembersToDrawerData(members, report, app),
    };
  }

  /**
   * Derives organization-wide at-risk members drawer content.
   * Uses view model's getAtRiskMembers() method (deduplicates across apps).
   */
  private getOrgAtRiskMembersContent(report: RiskInsightsView): OrgAtRiskMembersData {
    const members = report.getAtRiskMembers();
    return {
      type: DrawerType.OrgAtRiskMembers,
      members: this.mapMembersToDrawerData(members, report),
    };
  }

  /**
   * Derives organization-wide at-risk applications drawer content.
   * Filters reports that have at-risk ciphers.
   */
  private getOrgAtRiskAppsContent(report: RiskInsightsView): OrgAtRiskAppsData {
    const atRiskApps = report.reports.filter((app) => app.isAtRisk());
    return {
      type: DrawerType.OrgAtRiskApps,
      applications: atRiskApps.map((app) => ({
        applicationName: app.applicationName,
        atRiskPasswordCount: app.atRiskPasswordCount,
      })),
    };
  }

  /**
   * Derives critical applications' at-risk members drawer content.
   * Uses view model's getCriticalApplications() method.
   */
  private getCriticalAtRiskMembersContent(report: RiskInsightsView): CriticalAtRiskMembersData {
    const criticalApps = report.getCriticalApplications();
    const criticalMemberIds = new Set<string>();

    // Collect unique member IDs from all critical apps
    criticalApps.forEach((app) => {
      Object.entries(app.memberRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .forEach(([memberId]) => criticalMemberIds.add(memberId));
    });

    const members = Array.from(criticalMemberIds)
      .map((id) => report.memberRegistry[id])
      .filter((entry): entry is MemberRegistryEntry => entry !== undefined);

    return {
      type: DrawerType.CriticalAtRiskMembers,
      members: this.mapMembersToDrawerData(members, report),
    };
  }

  /**
   * Derives critical applications' at-risk apps drawer content.
   * Filters critical apps that have at-risk ciphers.
   */
  private getCriticalAtRiskAppsContent(report: RiskInsightsView): CriticalAtRiskAppsData {
    const criticalApps = report.getCriticalApplications();
    const atRiskCriticalApps = criticalApps.filter((app) => app.isAtRisk());

    return {
      type: DrawerType.CriticalAtRiskApps,
      applications: atRiskCriticalApps.map((app) => ({
        applicationName: app.applicationName,
        atRiskPasswordCount: app.atRiskPasswordCount,
      })),
    };
  }

  /**
   * Maps member registry entries to drawer member data format.
   * Uses view model's getAtRiskPasswordCountForMember() method.
   */
  private mapMembersToDrawerData(
    members: MemberRegistryEntry[],
    report: any,
    app?: any,
  ): DrawerMemberData[] {
    return members.map((member) => ({
      email: member.email,
      userName: member.userName,
      userGuid: member.id,
      atRiskPasswordCount: report.getAtRiskPasswordCountForMember(member.id, app?.applicationName),
    }));
  }

  /**
   * Downloads at-risk members as CSV.
   * Content is derived from current drawer state.
   */
  downloadAtRiskMembers = async () => {
    try {
      const drawerState = this.drawerStateService.drawerState();
      const report = this.report();

      if (!drawerState.open || drawerState.type !== DrawerType.OrgAtRiskMembers || !report) {
        return;
      }

      const content = this.getOrgAtRiskMembersContent(report);
      if (!content.members || content.members.length === 0) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-members"),
        blobData: exportToCSV(content.members, {
          email: this.i18nService.t(this.csvHeaders.members.email),
          atRiskPasswordCount: this.i18nService.t(this.csvHeaders.members.atRiskPasswordCount),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      this.logService.error("Failed to download at-risk members", error);
    }
  };

  /**
   * Downloads at-risk applications as CSV.
   * Content is derived from current drawer state.
   */
  downloadAtRiskApplications = async () => {
    try {
      const drawerState = this.drawerStateService.drawerState();
      const report = this.report();

      if (!drawerState.open || drawerState.type !== DrawerType.OrgAtRiskApps || !report) {
        return;
      }

      const content = this.getOrgAtRiskAppsContent(report);
      if (!content.applications || content.applications.length === 0) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-applications"),
        blobData: exportToCSV(content.applications, {
          applicationName: this.i18nService.t(this.csvHeaders.applications.applicationName),
          atRiskPasswordCount: this.i18nService.t(this.csvHeaders.applications.atRiskPasswordCount),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      this.logService.error("Failed to download at-risk applications", error);
    }
  };
}

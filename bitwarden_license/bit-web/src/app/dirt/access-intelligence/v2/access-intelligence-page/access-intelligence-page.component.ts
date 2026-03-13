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
import { combineLatest, concat, distinctUntilChanged, filter, map, of, switchMap } from "rxjs";
import { concatMap, delay, skip } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import {
  MemberRegistryEntryView,
  ApplicationHealthView,
  AccessReportView,
} from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { ReportProgress } from "@bitwarden/bit-common/dirt/reports/risk-insights";
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
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { EmptyStateCardComponent } from "../../empty-state-card.component";
import { RiskInsightsTabType } from "../../models/risk-insights.models";
import { ReportLoadingComponent } from "../../shared/report-loading.component";
import { AllActivityV2Component } from "../all-activity-v2/all-activity-v2.component";
import { ApplicationsV2Component } from "../applications-v2/applications-v2.component";
import {
  AppAtRiskMembersData,
  CriticalAtRiskAppsData,
  CriticalAtRiskMembersData,
  DrawerContentData,
  DrawerMemberData,
  OrgAtRiskAppsData,
  OrgAtRiskMembersData,
} from "../models/drawer-content-data.types";
import { AccessIntelligenceDrawerV2Component } from "../shared/access-intelligence-drawer-v2/access-intelligence-drawer-v2.component";

type ProgressStep = ReportProgress | null;

@Component({
  selector: "app-access-intelligence-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./access-intelligence-page.component.html",
  imports: [
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
   * Note: This must be a regular property, not a signal.
   * The bit-tab-group component's two-way binding [(selectedIndex)] requires
   * direct property assignment, which doesn't work with signals.
   */
  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllActivity;

  protected readonly organizationId = signal<OrganizationId>("" as OrganizationId);
  protected readonly appsCount = computed(() => this.report()?.reports.length ?? 0);
  protected readonly dataLastUpdated = computed(() => this.report()?.creationDate ?? null);

  // Convert V2 observables to signals for template
  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
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

  protected currentDialogRef: DialogRef<unknown, AccessIntelligenceDrawerV2Component> | null = null;

  // Minimum time to display each progress step (in milliseconds)
  // Prevents jarring quick transitions between steps
  private readonly STEP_DISPLAY_DELAY_MS = 250;

  // Current progress step for loading component (null = not loading)
  // Uses concatMap with delay to ensure each step is displayed for a minimum time
  protected readonly currentProgressStep = signal<ProgressStep>(null);

  // Computed values from report
  protected readonly hasReportData = computed(() => {
    const report = this.report();
    return report !== null && report !== undefined && report.reports.length > 0;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accessIntelligenceService: AccessIntelligenceDataService,
    private drawerStateService: DrawerStateService,
    protected i18nService: I18nService,
    private dialogService: DialogService,
    private logService: LogService,
  ) {
    // Subscribe to tab index changes from query params
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllActivity;
    });

    // Subscribe to progress steps with delay to ensure each step is displayed for a minimum time.
    // - skip(1): Skip initial BehaviorSubject emission (stale Complete from previous run would
    //   briefly flash the loading component on page navigation)
    // - concatMap: Queue steps and process them sequentially
    // - FetchingMembers shows immediately so loading appears instantly when user clicks "Run Report"
    // - Subsequent steps are delayed to prevent jarring quick transitions
    // - After Complete is shown, emit null to hide loading (service never emits null after Complete)
    this.accessIntelligenceService.reportProgress$
      .pipe(
        skip(1),
        concatMap((step) => {
          if (step === null || step === ReportProgress.FetchingMembers) {
            return of(step);
          }
          if (step === ReportProgress.Complete) {
            return concat(
              of(step as ProgressStep).pipe(delay(this.STEP_DISPLAY_DELAY_MS)),
              of(null as ProgressStep).pipe(delay(this.STEP_DISPLAY_DELAY_MS)),
            );
          }
          return of(step).pipe(delay(this.STEP_DISPLAY_DELAY_MS));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((step) => {
        this.currentProgressStep.set(step);
      });
  }

  ngOnInit() {
    // Initialize for organization
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        filter(Boolean),
        switchMap((orgId) => {
          this.organizationId.set(orgId as OrganizationId);
          return this.accessIntelligenceService.initializeForOrganization$(orgId as OrganizationId);
        }),
      )
      .subscribe();

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

  /**
   * Derives drawer content on-demand from report$ + drawerState.
   * V2 pattern: content computed from view model methods, not pre-stored.
   */
  private setupDrawerSubscription(): void {
    combineLatest([this.drawerState$, this.accessIntelligenceService.report$])
      .pipe(
        distinctUntilChanged(
          ([prevState, prevReport], [currState, currReport]) =>
            prevState.open === currState.open &&
            prevState.type === currState.type &&
            prevState.invokerId === currState.invokerId &&
            prevReport === currReport,
        ),
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((content) => {
        if (content) {
          this.currentDialogRef = this.dialogService.openDrawer(
            AccessIntelligenceDrawerV2Component,
            {
              data: content,
            },
          );
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
    report: AccessReportView,
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
  private getOrgAtRiskMembersContent(report: AccessReportView): OrgAtRiskMembersData {
    const members = report.getAtRiskMembers();
    return {
      type: DrawerType.OrgAtRiskMembers,
      members: this.mapMembersToDrawerData(members, report),
    };
  }

  /**
   * Derives organization-wide at-risk applications drawer content.
   */
  private getOrgAtRiskAppsContent(report: AccessReportView): OrgAtRiskAppsData {
    return {
      type: DrawerType.OrgAtRiskApps,
      applications: report.getAtRiskApplications().map((app) => ({
        applicationName: app.applicationName,
        atRiskPasswordCount: app.atRiskPasswordCount,
      })),
    };
  }

  /**
   * Derives critical applications' at-risk members drawer content.
   */
  private getCriticalAtRiskMembersContent(report: AccessReportView): CriticalAtRiskMembersData {
    return {
      type: DrawerType.CriticalAtRiskMembers,
      members: this.mapMembersToDrawerData(report.getCriticalAtRiskMembers(), report),
    };
  }

  /**
   * Derives critical applications' at-risk apps drawer content.
   */
  private getCriticalAtRiskAppsContent(report: AccessReportView): CriticalAtRiskAppsData {
    return {
      type: DrawerType.CriticalAtRiskApps,
      applications: report.getCriticalAtRiskApplications().map((app) => ({
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
    members: MemberRegistryEntryView[],
    report: AccessReportView,
    app?: ApplicationHealthView,
  ): DrawerMemberData[] {
    return members.map((member) => ({
      email: member.email,
      userName: member.userName ?? "",
      userGuid: member.id,
      atRiskPasswordCount: report.getAtRiskPasswordCountForMember(member.id, app?.applicationName),
    }));
  }
}

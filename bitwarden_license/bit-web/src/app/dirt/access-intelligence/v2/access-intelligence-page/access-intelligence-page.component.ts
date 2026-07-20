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
  Injector,
  isDevMode,
  effect,
  afterNextRender,
  untracked,
} from "@angular/core";
import { toObservable, toSignal, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  combineLatest,
  concat,
  distinctUntilChanged,
  EMPTY,
  filter,
  from,
  map,
  of,
  switchMap,
  tap,
} from "rxjs";
import { concatMap, delay, finalize, skip, take } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import {
  MemberRegistryEntryView,
  AccessReportView,
} from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { ReportProgress } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogRef,
  DialogService,
  IconComponent,
  PopoverModule,
  TabsModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { EmptyStateCardComponent } from "../../empty-state-card.component";
import { RiskInsightsTabType } from "../../models/risk-insights.models";
import { AccessIntelligenceCoachmarkComponent } from "../../onboarding/access-intelligence-coachmark.component";
import { AccessIntelligenceCoachmarkService } from "../../onboarding/access-intelligence-coachmark.service";
import { NewAdminWelcomeDialogComponent } from "../../onboarding/new-admin-welcome-dialog.component";
import { PostImportModalDialogComponent } from "../../onboarding/post-import-modal-dialog.component";
import { DevMenuComponent } from "../../shared/dev-menu.component";
import { PageLoadingComponent } from "../../shared/page-loading.component";
import { ReportLoadingComponent } from "../../shared/report-loading.component";
import { ActivityTabComponent } from "../activity-tab/activity-tab.component";
import { NewApplicationsDialogV2Component } from "../activity-tab/new-applications-dialog-v2/new-applications-dialog-v2.component";
import { AllApplicationsTabComponent } from "../all-applications-tab/all-applications-tab.component";
import { ApplicationsTabComponent } from "../applications-tab/applications-tab.component";
import { CriticalApplicationsTabComponent } from "../critical-applications-tab/critical-applications-tab.component";
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
    AccessIntelligenceCoachmarkComponent,
    ActivityTabComponent,
    AllApplicationsTabComponent,
    ApplicationsTabComponent,
    CriticalApplicationsTabComponent,
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    EmptyStateCardComponent,
    IconComponent,
    JslibModule,
    HeaderModule,
    PageLoadingComponent,
    PopoverModule,
    TabsModule,
    ReportLoadingComponent,
    DevMenuComponent,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly mustBeginPostImportTour = signal(false);

  protected readonly tabIndex = signal<RiskInsightsTabType>(RiskInsightsTabType.AllActivity);

  protected readonly organizationId = signal<OrganizationId>("" as OrganizationId);
  protected readonly appsCount = computed(() => this.report()?.reports.length ?? 0);
  protected readonly dataLastUpdated = computed(() => this.report()?.creationDate ?? null);

  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
  protected readonly loading = toSignal(
    this.accessIntelligenceService.loading$.pipe(
      skeletonLoadingDelay(1000, 1000), // Wait 1s before showing, min 1s display
    ),
  );
  protected readonly error = toSignal(this.accessIntelligenceService.error$);

  private readonly drawerState$ = toObservable(this.drawerStateService.drawerState);

  protected readonly emptyStateBenefits: [string, string][] = [
    [this.i18nService.t("feature1Title"), this.i18nService.t("feature1Description")],
    [this.i18nService.t("feature2Title"), this.i18nService.t("feature2Description")],
    [this.i18nService.t("feature3Title"), this.i18nService.t("feature3Description")],
  ];
  protected readonly emptyStateVideoSrc: string | null =
    "/videos/risk-insights-mark-as-critical.mp4";

  protected readonly currentDialogRef = signal<
    DialogRef<unknown, AccessIntelligenceDrawerV2Component> | undefined
  >(undefined);

  // Prevents jarring quick transitions between progress steps
  private readonly STEP_DISPLAY_DELAY_MS = 250;

  protected readonly initializing = signal(true);
  protected readonly currentProgressStep = signal<ProgressStep>(null);

  protected readonly hasReportData = computed(() => {
    const report = this.report();
    return report !== null && report !== undefined && report.reports.length > 0;
  });

  protected readonly criticalAppsCount = computed(
    () => this.report()?.getCriticalApplications().length ?? 0,
  );

  readonly milestone11Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.Milestone11AppPageImprovements),
    { initialValue: false },
  );

  protected readonly ciphers = toSignal(this.accessIntelligenceService.ciphers$, {
    initialValue: [],
  });

  protected readonly hasCiphers = computed(() => this.ciphers().length > 0);

  protected readonly invokedFrom = signal<{ source: string; status: string } | null>(null);

  readonly adoptionUxImprovementsEnabled = toSignal<boolean>(
    this.configService.getFeatureFlag$(FeatureFlag.AccessIntelligenceAdoptionUxImprovements),
  );

  protected readonly isDevMode = signal<boolean>(isDevMode());

  protected readonly monitorActivityOpen = computed(
    () => this.coachmarkService.activeStepId() === "monitorActivity",
  );

  protected readonly criticalApplicationsOpen = computed(
    () => this.coachmarkService.activeStepId() === "criticalApplications",
  );

  protected readonly runReportOpen = computed(
    () => this.coachmarkService.activeStepId() === "runReport",
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly accessIntelligenceService: AccessIntelligenceDataService,
    private readonly drawerStateService: DrawerStateService,
    protected readonly i18nService: I18nService,
    private readonly dialogService: DialogService,
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly injector: Injector,
    private readonly coachmarkService: AccessIntelligenceCoachmarkService,
  ) {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ tabIndex, source, status }) => {
        this.tabIndex.set(
          !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllActivity,
        );
        this.invokedFrom.set({ source, status });
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

    effect(() => {
      // determine if we need to begin the post import tour
      // wait for the report generation to complete (but only if we came via the post Import flow, indicated by mustBeginPostImportTour)
      // when report generation is complete (i.e. this.currentProgressStep() is null)
      // and mustBeginPostImportTour is true (set when user is navigated from import page after successful import)
      if (this.currentProgressStep() === null && this.mustBeginPostImportTour()) {
        this.mustBeginPostImportTour.set(false);

        // open the dialog only after the rendering of the report is complete
        afterNextRender(() => void this.beginPostImportTour(), { injector: this.injector });
      }
    });

    effect(() => {
      const requiredTabIndex = this.coachmarkService.requiredTabIndex();
      if (requiredTabIndex !== null && requiredTabIndex !== this.tabIndex()) {
        this.tabIndex.set(requiredTabIndex);

        // Reset drawer state and close drawer when tabs are changed
        // we need to ensure that the popover is closed before the tab is changed,
        // otherwise the popover will be hidden behind the new tab content
        const activeStepId = untracked(() => this.coachmarkService.activeStepId());
        this.coachmarkService.activeStepId.set(null); // close all popovers now

        // afterNextRender defers re-activation to after Angular's CD + rendering completes,
        // so the tab button is un-hidden before the popover measures its position.
        afterNextRender(() => this.coachmarkService.activeStepId.set(activeStepId), {
          injector: this.injector,
        });
      }
    });

    this.coachmarkService.tourCompleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const report = this.report();
      if (!report) {
        return;
      }
      NewApplicationsDialogV2Component.open(this.dialogService, {
        newApplications: report.getNewApplications(),
        organizationId: this.organizationId(),
        hasExistingCriticalApplications: report.getCriticalApplications().length > 0,
      });
    });
  }

  async ngOnInit() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        filter(Boolean),
        switchMap((orgId) => {
          this.initializing.set(true);
          this.organizationId.set(orgId as OrganizationId);
          return this.accessIntelligenceService
            .initializeForOrganization$(orgId as OrganizationId)
            .pipe(finalize(() => this.initializing.set(false)));
        }),
      )
      .subscribe();

    this.setupDrawerSubscription();

    // Close any open dialogs (happens when navigating between orgs)
    void this.currentDialogRef()?.close();

    // determine if we need to launch the new admin welcome tour
    // launch when there are no reports and no ciphers.
    combineLatest([
      toObservable(this.hasReportData, { injector: this.injector }),
      toObservable(this.hasCiphers, { injector: this.injector }),
      toObservable(this.initializing, { injector: this.injector }),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(([_, __, initializing]) => !initializing), // Wait until initialization is complete
        filter(([hasReportData, hasCiphers]) => !hasReportData && !hasCiphers),
        take(1),
      )
      .subscribe(() => {
        void this.beginNewAdminWelcomeTour().catch((error: unknown) => {
          this.logService.error("Failed to launch onboarding welcome", error);
        });
      });

    if (this.invokedFrom()?.source && this.invokedFrom()?.status) {
      await this.handleReturnParams(this.invokedFrom()?.source, this.invokedFrom()?.status);
    }
  }

  ngOnDestroy(): void {
    void this.currentDialogRef()?.close();
  }

  /**
   * Generates a new report for the current organization.
   */
  protected generateReport(): void {
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

  protected readonly goToImportPage = (): void => {
    void this.router.navigate(
      ["/organizations", this.organizationId(), "settings", "tools", "import"],
      { queryParams: { returnTo: "access-intelligence" } },
    );
  };

  protected async onTabChange(newIndex: number): Promise<void> {
    this.tabIndex.set(newIndex);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tabIndex: newIndex },
      queryParamsHandling: "merge",
    });

    // Reset drawer state and close drawer when tabs are changed
    // This ensures card selection state is cleared (PM-29263)
    this.drawerStateService.closeDrawer();
    await this.currentDialogRef()?.close();
  }

  /**
   * Opens or closes the drawer based on the current drawer state and report data.
   * Derives drawer content from the report on each state change.
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
        switchMap((content) => {
          if (!content) {
            void this.currentDialogRef()?.close();
            return EMPTY;
          }

          return from(
            this.dialogService.openDrawer(AccessIntelligenceDrawerV2Component, {
              data: content,
            }),
          ).pipe(
            tap((drawerRef) => this.currentDialogRef.set(drawerRef)),
            // Reset drawer state whenever the dialog closes (X, ESC, or programmatic close) so
            // re-clicking the same invoker reopens it. Without this, the state stays "open" and
            // the re-open is filtered out by distinctUntilChanged.
            switchMap((drawerRef) => drawerRef?.closed ?? EMPTY),
            tap(() => this.drawerStateService.closeDrawer()),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Builds drawer content for a specific application's at-risk members.
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
      members: this.mapMembersToDrawerData(members, report),
    };
  }

  /**
   * Builds drawer content for organization-wide at-risk members, deduplicated across apps.
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
    const members = report.getCriticalAtRiskMembers();
    return {
      type: DrawerType.CriticalAtRiskMembers,
      members: members.map((member) => ({
        email: member.email,
        atRiskApplicationCount: report.getAtRiskApplicationCountForMember(member.id, {
          criticalOnly: true,
        }),
      })),
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
   * Maps member registry entries to the data shape expected by the drawer component.
   */
  private mapMembersToDrawerData(
    members: MemberRegistryEntryView[],
    report: AccessReportView,
  ): DrawerMemberData[] {
    return members.map((member) => ({
      email: member.email,
      atRiskApplicationCount: report.getAtRiskApplicationCountForMember(member.id),
    }));
  }

  private async handleReturnParams(
    source: string | undefined,
    status: string | undefined,
  ): Promise<void> {
    if (source === "import" && status === "success") {
      this.generateReport();
      this.mustBeginPostImportTour.set(true);
    }

    this.clearQueryParams(this.router, this.route, ["source", "status"]);
  }

  private clearQueryParams(router: Router, route: ActivatedRoute, params: string[]) {
    // we don't want these params to persist in the URL after handling them, so we remove them
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { source: null, status: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  protected async beginPostImportTour(): Promise<void> {
    if (this.adoptionUxImprovementsEnabled()) {
      this.mustBeginPostImportTour.set(false);
      await PostImportModalDialogComponent.showDialog(
        this.injector,
        this.dialogService,
        this.organizationId(),
      );
    }
  }

  protected async beginNewAdminWelcomeTour(): Promise<void> {
    if (this.adoptionUxImprovementsEnabled()) {
      await NewAdminWelcomeDialogComponent.showDialog(
        this.injector,
        this.dialogService,
        this.organizationId(),
      );
    }
  }

  protected async beginCoachmarksTour(): Promise<void> {
    if (this.adoptionUxImprovementsEnabled()) {
      await this.coachmarkService.startTour(this.organizationId());
    }
  }
}

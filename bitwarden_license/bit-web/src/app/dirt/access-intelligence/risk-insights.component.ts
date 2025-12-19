import { animate, style, transition, trigger } from "@angular/animations";
import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { concat, EMPTY, firstValueFrom, of } from "rxjs";
import { concatMap, delay, distinctUntilChanged, map, skip, tap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DrawerType,
  ReportProgress,
  ReportStatus,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
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

import { AllActivityComponent } from "./activity/all-activity.component";
import { AllApplicationsComponent } from "./all-applications/all-applications.component";
import { CriticalApplicationsComponent } from "./critical-applications/critical-applications.component";
import { EmptyStateCardComponent } from "./empty-state-card.component";
import { RiskInsightsTabType } from "./models/risk-insights.models";
import { PageLoadingComponent } from "./shared/page-loading.component";
import { ReportLoadingComponent } from "./shared/report-loading.component";
import { RiskInsightsDrawerDialogComponent } from "./shared/risk-insights-drawer-dialog.component";

// Type alias for progress step (used in concatMap emissions)
type ProgressStep = ReportProgress | null;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./risk-insights.component.html",
  imports: [
    AllApplicationsComponent,
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    CriticalApplicationsComponent,
    EmptyStateCardComponent,
    JslibModule,
    HeaderModule,
    TabsModule,
    AllActivityComponent,
    ReportLoadingComponent,
    PageLoadingComponent,
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
export class RiskInsightsComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  protected ReportStatusEnum = ReportStatus;

  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllApps;
  isRiskInsightsActivityTabFeatureEnabled: boolean = false;

  appsCount: number = 0;

  protected organizationId: OrganizationId = "" as OrganizationId;

  dataLastUpdated: Date | null = null;

  // Empty state computed properties
  protected emptyStateBenefits: [string, string][] = [
    [this.i18nService.t("feature1Title"), this.i18nService.t("feature1Description")],
    [this.i18nService.t("feature2Title"), this.i18nService.t("feature2Description")],
    [this.i18nService.t("feature3Title"), this.i18nService.t("feature3Description")],
  ];
  protected emptyStateVideoSrc: string | null = "/videos/risk-insights-mark-as-critical.mp4";

  protected IMPORT_ICON = "bwi bwi-download";
  protected currentDialogRef: DialogRef<unknown, RiskInsightsDrawerDialogComponent> | null = null;

  // Current progress step for loading component (null = not loading)
  // Uses concatMap with delay to ensure each step is displayed for a minimum time
  protected readonly currentProgressStep = signal<ProgressStep>(null);

  // Minimum time to display each progress step (in milliseconds)
  private readonly STEP_DISPLAY_DELAY_MS = 250;

  // TODO: See https://github.com/bitwarden/clients/pull/16832#discussion_r2474523235

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    protected dataService: RiskInsightsDataService,
    protected i18nService: I18nService,
    protected dialogService: DialogService,
    private fileDownloadService: FileDownloadService,
    private logService: LogService,
  ) {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllApps;
    });

    this.configService
      .getFeatureFlag$(FeatureFlag.PM22887_RiskInsightsActivityTab)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isEnabled) => {
        this.isRiskInsightsActivityTabFeatureEnabled = isEnabled;
        this.tabIndex = 0; // default to first tab
      });
  }

  async ngOnInit() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        tap((orgId) => {
          if (orgId) {
            // Initialize Data Service
            void this.dataService.initializeForOrganization(orgId as OrganizationId);
            this.organizationId = orgId as OrganizationId;
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe();

    // Subscribe to report data updates
    // This declarative pattern ensures proper cleanup and prevents memory leaks
    this.dataService.enrichedReportData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((report) => {
        // Update report state
        this.appsCount = report?.reportData.length ?? 0;
        this.dataLastUpdated = report?.creationDate ?? null;
      });

    // Subscribe to drawer state changes
    this.dataService.drawerDetails$
      .pipe(
        distinctUntilChanged(
          (prev, curr) =>
            prev.activeDrawerType === curr.activeDrawerType && prev.invokerId === curr.invokerId,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((details) => {
        if (details.activeDrawerType !== DrawerType.None) {
          this.currentDialogRef = this.dialogService.openDrawer(RiskInsightsDrawerDialogComponent, {
            data: details,
          });
        } else {
          this.currentDialogRef?.close();
        }
      });

    // if any dialogs are open close it
    // this happens when navigating between orgs
    // or just navigating away from the page and back
    this.currentDialogRef?.close();

    // Subscribe to progress steps with delay to ensure each step is displayed for a minimum time
    // - skip(1): Skip initial BehaviorSubject emission (may contain stale Complete from previous run)
    // - concatMap: Queue steps and process them sequentially
    // - First visible step (FetchingMembers) shows immediately so loading appears instantly
    // - Subsequent steps are delayed to prevent jarring quick transitions
    // - After Complete step is shown, emit null to hide loading
    this.dataService.reportProgress$
      .pipe(
        // Skip the initial emission from _reportProgressSubject (BehaviorSubject in orchestrator).
        // Without this, navigating to the page would flash the loading component briefly
        // because BehaviorSubject emits its current value (e.g., Complete from last run) to new subscribers.
        skip(1),
        concatMap((step) => {
          // Show null and FetchingMembers immediately (first visible step)
          // This ensures loading component appears instantly when user clicks "Run Report"
          if (step === null || step === ReportProgress.FetchingMembers) {
            return of(step);
          }
          // Delay subsequent steps to prevent jarring quick transitions
          if (step === ReportProgress.Complete) {
            // Show Complete step, wait, then emit null to hide loading
            // Why concat is needed:
            // - The orchestrator emits Complete but never emits null afterward
            // - Without this concat, the loading would stay on "Compiling insights..." forever
            // - The concat automatically emits null to hide the loader
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

  ngOnDestroy(): void {
    this.dataService.destroy();
    this.currentDialogRef?.close();
  }

  /**
   * Refreshes the data by re-fetching the applications report.
   * This will automatically notify child components subscribed to the RiskInsightsDataService observables.
   */
  generateReport(): void {
    if (this.organizationId) {
      this.dataService.triggerReport();
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
    this.dataService.closeDrawer();
    this.currentDialogRef?.close();
  }

  // Empty state methods

  // TODO: import data button (we have this) OR button for adding new login items
  // we want to add this new button as a second option on the empty state card

  goToImportPage = () => {
    void this.router.navigate([
      "/organizations",
      this.organizationId,
      "settings",
      "tools",
      "import",
    ]);
  };

  /**
   * downloads at risk members as CSV
   */
  downloadAtRiskMembers = async () => {
    try {
      const drawerDetails = await firstValueFrom(this.dataService.drawerDetails$);

      // Validate drawer is open and showing the correct drawer type
      if (
        !drawerDetails.open ||
        drawerDetails.activeDrawerType !== DrawerType.OrgAtRiskMembers ||
        !drawerDetails.atRiskMemberDetails ||
        drawerDetails.atRiskMemberDetails.length === 0
      ) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-members"),
        blobData: exportToCSV(drawerDetails.atRiskMemberDetails, {
          email: this.i18nService.t("email"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      // Log error for debugging
      this.logService.error("Failed to download at-risk members", error);
    }
  };

  /**
   * downloads at risk applications as CSV
   */
  downloadAtRiskApplications = async () => {
    try {
      const drawerDetails = await firstValueFrom(this.dataService.drawerDetails$);

      // Validate drawer is open and showing the correct drawer type
      if (
        !drawerDetails.open ||
        drawerDetails.activeDrawerType !== DrawerType.OrgAtRiskApps ||
        !drawerDetails.atRiskAppDetails ||
        drawerDetails.atRiskAppDetails.length === 0
      ) {
        return;
      }

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("at-risk-applications"),
        blobData: exportToCSV(drawerDetails.atRiskAppDetails, {
          applicationName: this.i18nService.t("application"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      // Log error for debugging
      this.logService.error("Failed to download at-risk applications", error);
    }
  };
}

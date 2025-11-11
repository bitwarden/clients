import { animate, style, transition, trigger } from "@angular/animations";
import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, EMPTY } from "rxjs";
import { distinctUntilChanged, map, tap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DrawerType,
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
import { RiskInsightsDrawerDialogComponent } from "./shared/risk-insights-drawer-dialog.component";
import { ApplicationsLoadingComponent } from "./shared/risk-insights-loading.component";

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
    ApplicationsLoadingComponent,
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

  // Empty state properties
  protected organizationName = "";

  // Empty state computed properties
  protected emptyStateBenefits: [string, string][] = [
    [this.i18nService.t("benefit1Title"), this.i18nService.t("benefit1Description")],
    [this.i18nService.t("benefit2Title"), this.i18nService.t("benefit2Description")],
    [this.i18nService.t("benefit3Title"), this.i18nService.t("benefit3Description")],
  ];
  protected emptyStateVideoSrc: string | null = "/videos/risk-insights-mark-as-critical.mp4";

  protected IMPORT_ICON = "bwi bwi-download";
  protected currentDialogRef: DialogRef<unknown, RiskInsightsDrawerDialogComponent> | null = null;

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

    // Combine report data, vault items check, organization details, and generation state
    // This declarative pattern ensures proper cleanup and prevents memory leaks
    combineLatest([this.dataService.enrichedReportData$, this.dataService.organizationDetails$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([report, orgDetails]) => {
        // Update report state
        this.appsCount = report?.reportData.length ?? 0;
        this.dataLastUpdated = report?.creationDate ?? null;

        // Update organization name
        this.organizationName = orgDetails?.organizationName ?? "";
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

    // close drawer when tabs are changed
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

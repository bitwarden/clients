import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnDestroy, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, EMPTY } from "rxjs";
import { map, tap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DrawerType,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DrawerBodyComponent,
  DrawerComponent,
  DrawerHeaderComponent,
  TabsModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AllActivityComponent } from "./activity/all-activity.component";
import { AllApplicationsComponent } from "./all-applications/all-applications.component";
import { CriticalApplicationsComponent } from "./critical-applications/critical-applications.component";
import { EmptyStateCardComponent } from "./empty-state-card.component";
import { RiskInsightsTabType } from "./models/risk-insights.models";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
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
    DrawerComponent,
    DrawerBodyComponent,
    DrawerHeaderComponent,
    AllActivityComponent,
  ],
})
export class RiskInsightsComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private _isDrawerOpen: boolean = false;

  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllApps;
  isRiskInsightsActivityTabFeatureEnabled: boolean = false;

  appsCount: number = 0;
  // Leaving this commented because it's not used but seems important
  // notifiedMembersCount: number = 0;

  private organizationId: OrganizationId = "" as OrganizationId;

  dataLastUpdated: Date | null = null;
  refetching: boolean = false;

  // Empty state properties
  protected hasReportBeenRun = false;
  protected reportHasLoaded = false;
  protected hasVaultItems = false;
  private organizationName = "";

  // Empty state computed properties
  protected shouldShowImportDataState = false;
  protected emptyStateTitle = "";
  protected emptyStateDescription = "";
  protected emptyStateBenefits: [string, string][] = [];
  protected emptyStateButtonText = "";
  protected emptyStateButtonIcon = "";
  protected emptyStateButtonAction: (() => void) | null = null;
  protected emptyStateVideoSrc: string | null = "/videos/risk-insights-mark-as-critical.mp4";

  private static readonly IMPORT_ICON = "bwi bwi-download";

  // TODO: See https://github.com/bitwarden/clients/pull/16832#discussion_r2474523235

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    protected dataService: RiskInsightsDataService,
    private i18nService: I18nService,
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
    combineLatest([
      this.dataService.enrichedReportData$,
      this.dataService.hasVaultItems$,
      this.dataService.organizationDetails$,
      this.dataService.isGeneratingReport$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([report, hasVaultItems, orgDetails, isGenerating]) => {
        // Update report state
        this.reportHasLoaded = true;
        this.hasReportBeenRun = !!report?.creationDate;
        this.appsCount = report?.reportData.length ?? 0;
        this.dataLastUpdated = report?.creationDate ?? null;

        // Update vault items state
        this.hasVaultItems = hasVaultItems;

        // Update organization name
        this.organizationName = orgDetails?.organizationName ?? "";

        // Update all empty state properties based on current state
        this.updateEmptyStateProperties(isGenerating);
      });

    // Subscribe to drawer state changes
    this.dataService.drawerDetails$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((details) => {
        this._isDrawerOpen = details.open;
      });
  }

  ngOnDestroy(): void {
    this.dataService.destroy();
  }

  runReport = () => {
    this.dataService.triggerReport();
  };

  /**
   * Refreshes the data by re-fetching the applications report.
   * This will automatically notify child components subscribed to the RiskInsightsDataService observables.
   */
  generateReport(): void {
    if (this.organizationId) {
      this.dataService.triggerReport();
    }
  }

  get shouldShowTabs(): boolean {
    return this.appsCount > 0;
  }

  async onTabChange(newIndex: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tabIndex: newIndex },
      queryParamsHandling: "merge",
    });

    // close drawer when tabs are changed
    this.dataService.closeDrawer();
  }

  // Get a list of drawer types
  get drawerTypes(): typeof DrawerType {
    return DrawerType;
  }

  /**
   * Special case getter for syncing drawer state from service to component.
   * This allows the template to use two-way binding while staying reactive.
   */
  get isDrawerOpen() {
    return this._isDrawerOpen;
  }

  /**
   * Special case setter for syncing drawer state from component to service.
   * When the drawer component closes the drawer, this syncs the state back to the service.
   */
  set isDrawerOpen(value: boolean) {
    if (this._isDrawerOpen !== value) {
      this._isDrawerOpen = value;

      // Close the drawer in the service if the drawer component closed the drawer
      if (!value) {
        this.dataService.closeDrawer();
      }
    }
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
   * Updates all empty state properties based on current state.
   * Called whenever the underlying data (hasVaultItems, hasReportBeenRun, reportHasLoaded) changes.
   */
  private updateEmptyStateProperties(isGenerating: boolean): void {
    // Calculate boolean flags
    // Note: We only show empty states when there are NO apps (appsCount === 0)
    // The template uses @if(shouldShowTabs) to determine whether to show tabs or empty state
    this.shouldShowImportDataState = !this.hasVaultItems && !isGenerating;

    // Update benefits (constant for all states)
    this.emptyStateBenefits = [
      [this.i18nService.t("benefit1Title"), this.i18nService.t("benefit1Description")],
      [this.i18nService.t("benefit2Title"), this.i18nService.t("benefit2Description")],
      [this.i18nService.t("benefit3Title"), this.i18nService.t("benefit3Description")],
    ];

    // Update all state-dependent properties in single if/else
    if (this.shouldShowImportDataState) {
      this.emptyStateTitle = this.i18nService.t(
        "noApplicationsInOrgTitle",
        this.getOrganizationName(),
      );
      this.emptyStateDescription = this.i18nService.t("noApplicationsInOrgDescription");
      this.emptyStateButtonText = this.i18nService.t("importData");
      this.emptyStateButtonIcon = RiskInsightsComponent.IMPORT_ICON;
      this.emptyStateButtonAction = this.goToImportPage;
    } else {
      this.emptyStateTitle = this.i18nService.t("noReportRunTitle");
      this.emptyStateDescription = this.i18nService.t("noReportRunDescription");
      this.emptyStateButtonText = this.i18nService.t("riskInsightsRunReport");
      this.emptyStateButtonIcon = "";
      this.emptyStateButtonAction = this.runReport;
    }
  }

  private getOrganizationName(): string {
    return this.organizationName;
  }
}

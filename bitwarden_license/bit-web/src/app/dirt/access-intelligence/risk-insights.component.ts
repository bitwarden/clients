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
import { EMPTY } from "rxjs";
import { map, tap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DrawerType,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { AsyncActionsModule, ButtonModule, DialogService, TabsModule } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AllActivityComponent } from "./activity/all-activity.component";
import { AllApplicationsComponent } from "./all-applications/all-applications.component";
import { CriticalApplicationsComponent } from "./critical-applications/critical-applications.component";
import { RiskInsightsTabType } from "./models/risk-insights.models";
import { RiskInsightsDrawerDialogComponent } from "./shared/risk-insights-drawer-dialog.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./risk-insights.component.html",
  imports: [
    AllApplicationsComponent,
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    CriticalApplicationsComponent,
    JslibModule,
    HeaderModule,
    TabsModule,
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    protected dataService: RiskInsightsDataService,
    protected dialogService: DialogService,
  ) {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllApps;
    });

    this.configService
      .getFeatureFlag$(FeatureFlag.PM22887_RiskInsightsActivityTab)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isEnabled) => {
        this.isRiskInsightsActivityTabFeatureEnabled = isEnabled;
        this.tabIndex = 0; // default to first tab
      });

    this.dataService.drawerDetails$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((details) => {
        if (details.activeDrawerType !== DrawerType.None) {
          this.dialogService.openDrawer(RiskInsightsDrawerDialogComponent, {
            data: { ...details },
          });
        }
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
            this.dataService.initializeForOrganization(orgId as OrganizationId);
            this.organizationId = orgId as OrganizationId;
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe();

    // Subscribe to report result details
    this.dataService.enrichedReportData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((report) => {
        this.appsCount = report?.reportData.length ?? 0;
        this.dataLastUpdated = report?.creationDate ?? null;
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
}

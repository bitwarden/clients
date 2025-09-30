import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { EMPTY, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { DrawerType } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

import { AllActivityComponent } from "./all-activity.component";
import { AllApplicationsComponent } from "./all-applications.component";
import { CriticalApplicationsComponent } from "./critical-applications.component";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum RiskInsightsTabType {
  AllActivity = 0,
  AllApps = 1,
  CriticalApps = 2,
  NotifiedMembers = 3,
}

@Component({
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
    DrawerComponent,
    DrawerBodyComponent,
    DrawerHeaderComponent,
    AllActivityComponent,
  ],
})
export class RiskInsightsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private _isDrawerOpen: boolean = false;

  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllApps;
  isRiskInsightsActivityTabFeatureEnabled: boolean = false;

  appsCount: number = 0;
  // Leaving this commented because it's not used but seems important
  // notifiedMembersCount: number = 0;

  private organizationId: OrganizationId = "" as OrganizationId;

  isRefreshing$: Observable<boolean> = new Observable<boolean>();
  dataLastUpdated: Date | null = null;
  refetching: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    protected dataService: RiskInsightsDataService,
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
  }

  async ngOnInit() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        switchMap((orgId) => {
          if (orgId) {
            // Initialize Data Service
            void this.dataService.initializeForOrganization(orgId as OrganizationId);

            this.organizationId = orgId as OrganizationId;
            this.dataService.LEGACY_fetchApplicationsReport(this.organizationId);
            this.isRefreshing$ = this.dataService.isRefreshing$;
            return this.dataService.LEGACY_applications$;
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe();

    // Subscribe to report result details
    this.dataService.reportResults$
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
  runReport = () => {
    this.dataService.triggerReport();
  };

  /**
   * Refreshes the data by re-fetching the applications report.
   * This will automatically notify child components subscribed to the RiskInsightsDataService observables.
   */
  refreshData(): void {
    if (this.organizationId) {
      // this.dataService.refreshApplicationsReport(this.organizationId);
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

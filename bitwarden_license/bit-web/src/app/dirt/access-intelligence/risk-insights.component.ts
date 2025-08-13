import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { EMPTY } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  DrawerType,
  ReportDetailsAndSummary,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DrawerBodyComponent,
  DrawerComponent,
  DrawerHeaderComponent,
  LayoutComponent,
  TabsModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AllApplicationsComponent } from "./all-applications.component";
import { CriticalApplicationsComponent } from "./critical-applications.component";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum RiskInsightsTabType {
  AllApps = 0,
  CriticalApps = 1,
  NotifiedMembers = 2,
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
    LayoutComponent,
  ],
})
export class RiskInsightsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private _isDrawerOpen: boolean = false;

  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllApps;

  reportResults: ReportDetailsAndSummary | null = null;
  isRunningReport: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    protected dataService: RiskInsightsDataService,
  ) {}

  async ngOnInit() {
    // Setup tabs from route
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllApps;
    });

    // Setup organization id from route
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        switchMap(async (orgId) => {
          if (orgId) {
            // Initialize the data service with the organization id
            await this.dataService.initialize(orgId as OrganizationId);
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe();

    // Subscribe to drawer changes
    this.dataService.drawerDetails$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((details) => {
        this._isDrawerOpen = details.open;
      });

    // Subscribe to report details
    this.dataService.reportResults$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reportResults) => (this.reportResults = reportResults));

    // Subscribe to is running report flag
    this.dataService.isRunningReport$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isRunning) => (this.isRunningReport = isRunning));
  }

  /**
   * Refreshes the data by re-fetching the applications report.
   * This will automatically notify child components subscribed to the RiskInsightsDataService observables.
   */
  runReport = () => {
    this.dataService.triggerReport();
  };

  get isDrawerOpen() {
    return this._isDrawerOpen;
  }

  set isDrawerOpen(value: boolean) {
    if (this._isDrawerOpen !== value) {
      this._isDrawerOpen = value;

      // Close the drawer in the service if the drawer component closed the drawer
      if (!value) {
        this.dataService.closeDrawer();
      }
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
}

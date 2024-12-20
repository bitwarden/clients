import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { Observable, EMPTY } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsDataService } from "@bitwarden/bit-common/tools/reports/risk-insights";
import { ApplicationHealthReportDetail } from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { AsyncActionsModule, ButtonModule, TabsModule } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { AllApplicationsComponent } from "./all-applications.component";
import { CriticalApplicationsComponent } from "./critical-applications.component";
import { NotifiedMembersTableComponent } from "./notified-members-table.component";

export enum RiskInsightsTabType {
  AllApps = 0,
  CriticalApps = 1,
  NotifiedMembers = 2,
}

@Component({
  standalone: true,
  templateUrl: "./risk-insights.component.html",
  imports: [
    AllApplicationsComponent,
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    CriticalApplicationsComponent,
    JslibModule,
    HeaderModule,
    NotifiedMembersTableComponent,
    TabsModule,
  ],
})
export class RiskInsightsComponent implements OnInit {
  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllApps;

  dataLastUpdated: Date = new Date();

  isCriticalAppsFeatureEnabled: boolean = false;

  appsCount: number = 0;
  criticalAppsCount: number = 0;
  notifiedMembersCount: number = 0;

  private organizationId: string | null = null;
  private destroyRef = inject(DestroyRef);
  isLoading$: Observable<boolean> = new Observable<boolean>();
  isRefreshing$: Observable<boolean> = new Observable<boolean>();
  dataLastUpdated$: Observable<Date | null> = new Observable<Date | null>();
  refetching: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    private dataService: RiskInsightsDataService,
  ) {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllApps;
    });
  }

  async ngOnInit() {
    this.isCriticalAppsFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CriticalApps,
    );

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        switchMap((orgId: string | null) => {
          if (orgId) {
            this.organizationId = orgId;
            this.dataService.fetchApplicationsReport(orgId);
            this.isLoading$ = this.dataService.isLoading$;
            this.isRefreshing$ = this.dataService.isRefreshing$;
            this.dataLastUpdated$ = this.dataService.dataLastUpdated$;
            return this.dataService.applications$;
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe({
        next: (applications: ApplicationHealthReportDetail[] | null) => {
          if (applications) {
            this.appsCount = applications.length;
          }
        },
      });
  }

  /**
   * Refreshes the data by re-fetching the applications report.
   * This will automatically notify child components subscribed to the RiskInsightsDataService observables.
   */
  refreshData(): void {
    if (this.organizationId) {
      this.dataService.refreshApplicationsReport(this.organizationId);
    }
  }

  async onTabChange(newIndex: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tabIndex: newIndex },
      queryParamsHandling: "merge",
    });
  }
}

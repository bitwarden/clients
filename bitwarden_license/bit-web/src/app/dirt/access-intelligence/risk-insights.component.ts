import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { EMPTY, firstValueFrom, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CriticalAppsService,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  ApplicationHealthReportDetail,
  DrawerType,
  PasswordHealthReportApplicationsResponse,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/password-health";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
  ],
})
export class RiskInsightsComponent implements OnInit {
  tabIndex: RiskInsightsTabType = RiskInsightsTabType.AllApps;

  dataLastUpdated: Date = new Date();

  criticalApps$: Observable<PasswordHealthReportApplicationsResponse[]> = new Observable();

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
    protected dataService: RiskInsightsDataService,
    private criticalAppsService: CriticalAppsService,
    private accountService: AccountService,
  ) {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : RiskInsightsTabType.AllApps;
    });
  }

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

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

          this.criticalAppsService.setOrganizationId(this.organizationId as OrganizationId, userId);
          this.criticalApps$ = this.criticalAppsService.getAppsListForOrg(
            this.organizationId as OrganizationId,
          );
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

    // close drawer when tabs are changed
    this.dataService.closeDrawer();
  }

  // Get a list of drawer types
  get drawerTypes(): typeof DrawerType {
    return DrawerType;
  }
}

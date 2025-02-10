// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, debounceTime, map } from "rxjs";

import {
  CriticalAppsService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import {
  ApplicationHealthReportDetailWithCriticalFlag,
  ApplicationHealthReportSummary,
} from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  Icons,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";
import { CardComponent } from "@bitwarden/tools-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { RiskInsightsTabType } from "./risk-insights.component";

@Component({
  standalone: true,
  selector: "tools-critical-applications",
  templateUrl: "./critical-applications.component.html",
  imports: [CardComponent, HeaderModule, SearchModule, NoItemsModule, PipesModule, SharedModule],
  providers: [],
})
export class CriticalApplicationsComponent implements OnInit {
  protected dataSource = new TableDataSource<ApplicationHealthReportDetailWithCriticalFlag>();
  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });
  private destroyRef = inject(DestroyRef);
  protected loading = false;
  protected organizationId: string;
  protected applicationSummary = {} as ApplicationHealthReportSummary;
  noItemsIcon = Icons.Security;
  isNotificationsFeatureEnabled: boolean = false;

  async ngOnInit() {
    this.isNotificationsFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.EnableRiskInsightsNotifications,
    );
    this.organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId") ?? "";
    combineLatest([
      this.dataService.applications$,
      this.criticalAppsService.getAppsListForOrg(this.organizationId),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(([applications, criticalApps]) => {
          const criticalUrls = criticalApps.map((ca) => ca.uri);
          const data = applications?.map((app) => ({
            ...app,
            isMarkedAsCritical: criticalUrls.includes(app.applicationName),
          })) as ApplicationHealthReportDetailWithCriticalFlag[];
          return data?.filter((app) => app.isMarkedAsCritical);
        }),
      )
      .subscribe((applications) => {
        if (applications) {
          this.dataSource.data = applications;
          this.applicationSummary = this.reportService.generateApplicationsSummary(applications);
        }
      });
  }

  goToAllAppsTab = async () => {
    await this.router.navigate([`organizations/${this.organizationId}/risk-insights`], {
      queryParams: { tabIndex: RiskInsightsTabType.AllApps },
      queryParamsHandling: "merge",
    });
  };

  unmarkAsCriticalApp = async (hostname: string) => {
    try {
      await this.criticalAppsService.dropCriticalApp(
        this.organizationId as OrganizationId,
        hostname,
      );
    } catch {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        variant: "error",
        title: this.i18nService.t("error"),
      });
      return;
    }

    this.toastService.showToast({
      message: this.i18nService.t("criticalApplicationSuccessfullyUnmarked"),
      variant: "success",
      title: this.i18nService.t("success"),
    });
    this.dataSource.data = this.dataSource.data.filter((app) => app.applicationName !== hostname);
  };

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    protected criticalAppsService: CriticalAppsService,
    protected reportService: RiskInsightsReportService,
    protected i18nService: I18nService,
    private configService: ConfigService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  showAppAtRiskMembers = async (applicationName: string) => {
    const data = {
      members:
        this.dataSource.data.find((app) => app.applicationName === applicationName)
          ?.atRiskMemberDetails ?? [],
      applicationName,
    };
    this.dataService.setDrawerForAppAtRiskMembers(data, applicationName);
  };

  showOrgAtRiskMembers = async (invokerId: string) => {
    const data = this.reportService.generateAtRiskMemberList(this.dataSource.data);
    this.dataService.setDrawerForOrgAtRiskMembers(data, invokerId);
  };

  showOrgAtRiskApps = async (invokerId: string) => {
    const data = this.reportService.generateAtRiskApplicationList(this.dataSource.data);
    this.dataService.setDrawerForOrgAtRiskApps(data, invokerId);
  };

  trackByFunction(_: number, item: ApplicationHealthReportDetailWithCriticalFlag) {
    return item.applicationName;
  }
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, EMPTY, map, switchMap } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  ApplicationHealthReportDetailEnriched,
  CriticalAppsService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { createNewSummaryData } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import { OrganizationReportSummary } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { NoItemsModule, SearchModule, TableDataSource, ToastService } from "@bitwarden/components";
import { CardComponent } from "@bitwarden/dirt-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";
import { RiskInsightsTabType } from "../models/risk-insights.models";
import { AppTableRowScrollableComponent } from "../shared/app-table-row-scrollable.component";
import { AccessIntelligenceSecurityTasksService } from "../shared/security-tasks.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-critical-applications",
  templateUrl: "./critical-applications.component.html",
  imports: [
    CardComponent,
    HeaderModule,
    SearchModule,
    NoItemsModule,
    PipesModule,
    SharedModule,
    AppTableRowScrollableComponent,
  ],
  providers: [AccessIntelligenceSecurityTasksService, DefaultAdminTaskService],
})
export class CriticalApplicationsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  protected enableRequestPasswordChange = false;
  protected organizationId: OrganizationId;
  noItemsIcon = Security;

  protected dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
  protected applicationSummary = {} as OrganizationReportSummary;

  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    protected criticalAppsService: CriticalAppsService,
    protected reportService: RiskInsightsReportService,
    protected i18nService: I18nService,
    private accessIntelligenceSecurityTasksService: AccessIntelligenceSecurityTasksService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.dataService.criticalReportResults$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (criticalReport) => {
        this.dataSource.data = criticalReport?.reportData ?? [];
        this.applicationSummary = criticalReport?.summaryData ?? createNewSummaryData();
        this.enableRequestPasswordChange = criticalReport?.summaryData?.totalAtRiskMemberCount > 0;
      },
      error: () => {
        this.dataSource.data = [];
        this.applicationSummary = createNewSummaryData();
        this.enableRequestPasswordChange = false;
      },
    });
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        switchMap(async (orgId) => {
          if (orgId) {
            this.organizationId = orgId as OrganizationId;
          } else {
            return EMPTY;
          }
        }),
      )
      .subscribe();
  }

  goToAllAppsTab = async () => {
    await this.router.navigate(
      [`organizations/${this.organizationId}/access-intelligence/risk-insights`],
      {
        queryParams: { tabIndex: RiskInsightsTabType.AllApps },
        queryParamsHandling: "merge",
      },
    );
  };

  removeCriticalApplication = async (hostname: string) => {
    this.dataService
      .removeCriticalApplication(hostname)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t("criticalApplicationUnmarkedSuccessfully"),
            variant: "success",
          });
        },
        error: () => {
          this.toastService.showToast({
            message: this.i18nService.t("unexpectedError"),
            variant: "error",
            title: this.i18nService.t("error"),
          });
        },
      });
  };

  async requestPasswordChange() {
    await this.accessIntelligenceSecurityTasksService.assignTasks(
      this.organizationId,
      this.dataSource.data,
    );
  }

  showAppAtRiskMembers = async (applicationName: string) => {
    await this.dataService.setDrawerForAppAtRiskMembers(applicationName);
  };
}

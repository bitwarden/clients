// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime } from "rxjs";

import {
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  ApplicationHealthReportDetailEnriched,
  ApplicationHealthReportSummary,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";
import {
  Icons,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";
import { CardComponent } from "@bitwarden/dirt-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { CreateTasksRequest } from "../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { AppTableRowScrollableComponent } from "./app-table-row-scrollable.component";
import { RiskInsightsTabType } from "./risk-insights.component";

@Component({
  selector: "tools-critical-applications",
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
  providers: [DefaultAdminTaskService],
})
export class CriticalApplicationsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  protected dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();

  protected searchControl = new FormControl("", { nonNullable: true });
  protected organizationId: OrganizationId;
  protected summary = {} as ApplicationHealthReportSummary;

  noItemsIcon = Icons.Security;
  enableRequestPasswordChange = false;

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    protected reportService: RiskInsightsReportService,
    protected i18nService: I18nService,
    private adminTaskService: DefaultAdminTaskService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.organizationId = this.activatedRoute.snapshot.paramMap.get(
      "organizationId",
    ) as OrganizationId;
    this.dataService
      .getCriticalReport$(this.dataService.reportResults$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((criticalReport) => {
        if (criticalReport) {
          this.summary = this.reportService.generateApplicationsSummary(criticalReport.data);
          this.dataSource.data = criticalReport.data;
        }
      });
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

  removeCriticalApp = async (hostname: string) => {
    try {
      await this.dataService.dropCriticalApp(hostname);
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

  async requestPasswordChange() {
    const apps = this.dataSource.data;
    const cipherIds = apps
      .filter((_) => _.atRiskPasswordCount > 0)
      .flatMap((app) => app.atRiskCipherIds);

    const distinctCipherIds = Array.from(new Set(cipherIds));

    const tasks: CreateTasksRequest[] = distinctCipherIds.map((cipherId) => ({
      cipherId: cipherId as CipherId,
      type: SecurityTaskType.UpdateAtRiskCredential,
    }));

    try {
      await this.adminTaskService.bulkCreateTasks(this.organizationId as OrganizationId, tasks);
      this.toastService.showToast({
        message: this.i18nService.t("notifiedMembers"),
        variant: "success",
        title: this.i18nService.t("success"),
      });
    } catch {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        variant: "error",
        title: this.i18nService.t("error"),
      });
    }
  }

  // Open side drawer to show at risk members for an application
  showAppAtRiskMembers = async (applicationName: string) => {
    const data = {
      members:
        this.dataSource.data.find((app) => app.applicationName === applicationName)
          ?.atRiskMemberDetails ?? [],
      applicationName,
    };
    this.dataService.setDrawerForAppAtRiskMembers(data, applicationName);
  };

  // Open side drawer to show at risk members for the entire organization
  showOrgAtRiskMembers = async (invokerId: string) => {
    const data = this.reportService.generateAtRiskMemberList(this.dataSource.data);
    this.dataService.setDrawerForOrgAtRiskMembers(data, invokerId);
  };

  showOrgAtRiskApps = async (invokerId: string) => {
    const data = this.reportService.generateAtRiskApplicationList(this.dataSource.data);
    this.dataService.setDrawerForOrgAtRiskApps(data, invokerId);
  };
}

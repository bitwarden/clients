// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, debounceTime, firstValueFrom, map, switchMap } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  CriticalAppsService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  LEGACY_ApplicationHealthReportDetailWithCriticalFlag,
  LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/password-health";
import { OrganizationReportSummary } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { NoItemsModule, SearchModule, TableDataSource, ToastService } from "@bitwarden/components";
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
  protected dataSource =
    new TableDataSource<LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher>();
  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });
  private destroyRef = inject(DestroyRef);
  protected loading = false;
  protected organizationId: OrganizationId;
  protected applicationSummary = {} as OrganizationReportSummary;
  noItemsIcon = Security;
  enableRequestPasswordChange = false;

  async ngOnInit() {
    this.organizationId = this.activatedRoute.snapshot.paramMap.get(
      "organizationId",
    ) as OrganizationId;
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.criticalAppsService.loadOrganizationContext(this.organizationId as OrganizationId, userId);

    if (this.organizationId) {
      combineLatest([
        this.dataService.applications$,
        this.criticalAppsService.getAppsListForOrg(this.organizationId as OrganizationId),
      ])
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          map(([applications, criticalApps]) => {
            const criticalUrls = criticalApps.map((ca) => ca.uri);
            const data = applications?.map((app) => ({
              ...app,
              isMarkedAsCritical: criticalUrls.includes(app.applicationName),
            })) as LEGACY_ApplicationHealthReportDetailWithCriticalFlag[];
            return data?.filter((app) => app.isMarkedAsCritical);
          }),
          switchMap(async (data) => {
            if (data) {
              const dataWithCiphers = await this.reportService.identifyCiphers(
                data,
                this.organizationId,
              );
              return dataWithCiphers;
            }
            return null;
          }),
        )
        .subscribe((applications) => {
          if (applications) {
            this.dataSource.data = applications;
            this.applicationSummary = this.reportService.generateApplicationsSummary(applications);
            this.enableRequestPasswordChange = this.applicationSummary.totalAtRiskMemberCount > 0;
          }
        });
    }
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

  unmarkAsCritical = async (hostname: string) => {
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
      message: this.i18nService.t("criticalApplicationUnmarkedSuccessfully"),
      variant: "success",
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

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    protected criticalAppsService: CriticalAppsService,
    protected reportService: RiskInsightsReportService,
    protected i18nService: I18nService,
    private configService: ConfigService,
    private adminTaskService: DefaultAdminTaskService,
    private accountService: AccountService,
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
}

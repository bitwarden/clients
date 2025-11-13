// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, EMPTY, from, map, switchMap, take } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
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

import { RiskInsightsTabType } from "../models/risk-insights.models";
import {
  ApplicationTableDataSource,
  AppTableRowScrollableComponent,
} from "../shared/app-table-row-scrollable.component";
import { AccessIntelligenceSecurityTasksService } from "../shared/security-tasks.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
})
export class CriticalApplicationsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  protected enableRequestPasswordChange = false;
  protected organizationId: OrganizationId;
  noItemsIcon = Security;

  protected dataSource = new TableDataSource<ApplicationTableDataSource>();
  protected applicationSummary = {} as OrganizationReportSummary;

  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected dataService: RiskInsightsDataService,
    protected criticalAppsService: CriticalAppsService,
    protected i18nService: I18nService,
    protected reportService: RiskInsightsReportService,
    protected router: Router,
    private securityTasksService: AccessIntelligenceSecurityTasksService,
    protected toastService: ToastService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.dataService.criticalReportResults$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (criticalReport) => {
        if (criticalReport != null) {
          // Map the report data to include the iconCipher for each application
          const tableDataWithIcon = criticalReport.reportData.map((app) => ({
            ...app,
            iconCipher:
              app.cipherIds.length > 0
                ? this.dataService.getCipherIcon(app.cipherIds[0])
                : undefined,
          }));
          this.dataSource.data = tableDataWithIcon;

          this.applicationSummary = criticalReport.summaryData;
          this.enableRequestPasswordChange = criticalReport.summaryData.totalAtRiskMemberCount > 0;
        } else {
          this.dataSource.data = [];
          this.applicationSummary = createNewSummaryData();
          this.enableRequestPasswordChange = false;
        }
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
    this.dataService.criticalApplicationAtRiskCipherIds$
      .pipe(
        takeUntilDestroyed(this.destroyRef), // Satisfy eslint rule
        take(1), // Handle unsubscribe for one off operation
        switchMap((cipherIds) => {
          return from(
            this.securityTasksService.requestPasswordChangeForCriticalApplications(
              this.organizationId,
              cipherIds,
            ),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t("notifiedMembers"),
            variant: "success",
            title: this.i18nService.t("success"),
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
  }

  showAppAtRiskMembers = async (applicationName: string) => {
    await this.dataService.setDrawerForAppAtRiskMembers(applicationName);
  };
}

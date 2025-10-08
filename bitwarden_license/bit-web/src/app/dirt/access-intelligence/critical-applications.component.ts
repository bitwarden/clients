// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, EMPTY, from, map, switchMap } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  ApplicationHealthReportDetailEnriched,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { createNewSummaryData } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import { OrganizationReportSummary } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { NoItemsModule, SearchModule, TableDataSource, ToastService } from "@bitwarden/components";
import { CardComponent } from "@bitwarden/dirt-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { CreateTasksRequest } from "../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { AppTableRowScrollableComponent } from "./app-table-row-scrollable.component";
import { EmptyStateCardComponent } from "./empty-state-card.component";
import { RiskInsightsTabType } from "./risk-insights.component";

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
    EmptyStateCardComponent,
  ],
  providers: [DefaultAdminTaskService],
})
export class CriticalApplicationsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  protected loading = false;
  protected enableRequestPasswordChange = false;
  protected organizationId: OrganizationId;
  protected hasReportBeenRun = false;
  protected reportHasLoaded = false;
  protected hasVaultItems = false;
  noItemsIcon = Security;

  private static readonly IMPORT_ICON = "bwi bwi-download";

  protected dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
  protected applicationSummary = {} as OrganizationReportSummary;

  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });

  constructor(
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    protected i18nService: I18nService,
    private adminTaskService: DefaultAdminTaskService,
    private cipherService: CipherService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.dataService.reportResults$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (report) => {
        this.reportHasLoaded = true;
        this.hasReportBeenRun = !!report?.creationDate;

        if (!this.hasReportBeenRun) {
          this.checkForVaultItems();
        }
      },
      error: () => {
        this.reportHasLoaded = true;
        this.hasReportBeenRun = false;
        this.checkForVaultItems();
      },
    });

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

  runReport = () => {
    this.dataService.triggerReport();
  };

  goToImportPage = () => {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    void this.router.navigate(["/organizations", organizationId, "settings", "tools", "import"]);
  };

  get shouldShowImportDataState(): boolean {
    return !this.hasVaultItems;
  }

  get shouldShowCriticalApplicationsState(): boolean {
    return this.hasVaultItems && this.reportHasLoaded && this.hasReportBeenRun;
  }

  get shouldShowRunReportState(): boolean {
    return this.hasVaultItems && this.reportHasLoaded && !this.hasReportBeenRun;
  }

  get emptyStateTitle(): string {
    if (this.shouldShowImportDataState) {
      return this.i18nService.t("noApplicationsInOrgTitle", this.organizationName);
    }
    if (this.shouldShowCriticalApplicationsState) {
      return this.i18nService.t("noCriticalApplicationsTitle");
    }
    return this.i18nService.t("noReportRunTitle");
  }

  get emptyStateDescription(): string {
    if (this.shouldShowImportDataState) {
      return this.i18nService.t("noApplicationsInOrgDescription");
    }
    if (this.shouldShowCriticalApplicationsState) {
      return this.i18nService.t("noCriticalApplicationsDescription");
    }
    return this.i18nService.t("noReportRunDescription");
  }

  get emptyStateBenefits(): string[] {
    if (this.shouldShowCriticalApplicationsState) {
      return [];
    }
    return [
      `${this.i18nService.t("benefit1Title")}|${this.i18nService.t("benefit1Description")}`,
      `${this.i18nService.t("benefit2Title")}|${this.i18nService.t("benefit2Description")}`,
      `${this.i18nService.t("benefit3Title")}|${this.i18nService.t("benefit3Description")}`,
    ];
  }

  get emptyStateButtonText(): string {
    if (this.shouldShowImportDataState) {
      return this.i18nService.t("importData");
    }
    if (this.shouldShowCriticalApplicationsState) {
      return this.i18nService.t("markCriticalApplications");
    }
    return this.i18nService.t("riskInsightsRunReport");
  }

  get emptyStateButtonIcon(): string {
    if (this.shouldShowImportDataState) {
      return CriticalApplicationsComponent.IMPORT_ICON;
    }
    return "";
  }

  get emptyStateButtonAction(): () => void {
    if (this.shouldShowImportDataState) {
      return this.goToImportPage;
    }
    if (this.shouldShowCriticalApplicationsState) {
      return this.goToAllAppsTab;
    }
    return this.runReport;
  }

  get emptyStateVideoSrc(): string | null {
    return "/videos/risk-insights-mark-as-critical.mp4";
  }

  private get organizationName(): string {
    return "";
  }

  private checkForVaultItems() {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    if (organizationId) {
      from(this.cipherService.getAllFromApiForOrganization(organizationId as any))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (ciphers) => {
            this.hasVaultItems = ciphers.length > 0;
          },
          error: () => {
            this.hasVaultItems = false;
          },
        });
    }
  }

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
  showAppAtRiskMembers = async (applicationName: string) => {
    await this.dataService.setDrawerForAppAtRiskMembers(applicationName);
  };
}

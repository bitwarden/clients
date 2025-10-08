import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, from } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  ApplicationHealthReportDetailEnriched,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { createNewSummaryData } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import { OrganizationReportSummary } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  IconButtonModule,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";
import { CardComponent } from "@bitwarden/dirt-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { AppTableRowScrollableComponent } from "./app-table-row-scrollable.component";
import { EmptyStateCardComponent } from "./empty-state-card.component";
import { ApplicationsLoadingComponent } from "./risk-insights-loading.component";

@Component({
  selector: "dirt-all-applications",
  templateUrl: "./all-applications.component.html",
  imports: [
    ApplicationsLoadingComponent,
    HeaderModule,
    CardComponent,
    SearchModule,
    PipesModule,
    NoItemsModule,
    SharedModule,
    AppTableRowScrollableComponent,
    IconButtonModule,
    EmptyStateCardComponent,
  ],
})
export class AllApplicationsComponent implements OnInit {
  protected dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
  protected selectedUrls: Set<string> = new Set<string>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected organization = new Organization();
  noItemsIcon = Security;
  protected markingAsCritical = false;
  protected applicationSummary: OrganizationReportSummary = createNewSummaryData();
  protected hasReportBeenRun = false;
  protected reportHasLoaded = false;
  protected hasVaultItems = false;

  private static readonly IMPORT_ICON = "bwi bwi-download";
  private static readonly PLAY_ICON = "bwi bwi-play";

  destroyRef = inject(DestroyRef);

  constructor(
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    private router: Router,
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
        this.applicationSummary = report?.summaryData ?? createNewSummaryData();
        this.dataSource.data = report?.reportData ?? [];

        if (!this.hasReportBeenRun) {
          this.checkForVaultItems();
        }
      },
      error: () => {
        this.reportHasLoaded = true;
        this.hasReportBeenRun = false;
        this.dataSource.data = [];
        this.checkForVaultItems();
      },
    });
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

  goToImportPage = () => {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    void this.router.navigate(["/organizations", organizationId, "settings", "tools", "import"]);
  };

  runReport = () => {
    this.dataService.triggerReport();
  };

  get shouldShowImportDataState(): boolean {
    return !this.hasVaultItems || (this.reportHasLoaded && this.hasReportBeenRun);
  }

  get shouldShowRunReportState(): boolean {
    return this.hasVaultItems && this.reportHasLoaded && !this.hasReportBeenRun;
  }

  get emptyStateTitle(): string {
    if (this.shouldShowImportDataState) {
      return this.i18nService.t("noApplicationsInOrgTitle", this.organizationName);
    }
    return this.i18nService.t("noReportRunTitle");
  }

  get emptyStateDescription(): string {
    if (this.shouldShowImportDataState) {
      return this.i18nService.t("noApplicationsInOrgDescription");
    }
    return this.i18nService.t("noReportRunDescription");
  }

  get emptyStateBenefits(): string[] {
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
    return this.i18nService.t("riskInsightsRunReport");
  }

  get emptyStateButtonIcon(): string {
    if (this.shouldShowImportDataState) {
      return AllApplicationsComponent.IMPORT_ICON;
    }
    return "";
  }

  get emptyStateButtonAction(): () => void {
    if (this.shouldShowImportDataState) {
      return this.goToImportPage;
    }
    return this.runReport;
  }

  get emptyStateVideoSrc(): string | null {
    return "/videos/risk-insights-mark-as-critical.mp4";
  }

  private get organizationName(): string {
    return "";
  }

  isMarkedAsCriticalItem(applicationName: string) {
    return this.selectedUrls.has(applicationName);
  }

  markAppsAsCritical = async () => {
    this.markingAsCritical = true;

    this.dataService
      .saveCriticalApplications(Array.from(this.selectedUrls))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("applicationsMarkedAsCriticalSuccess"),
          });
          this.selectedUrls.clear();
          this.markingAsCritical = false;
        },
        error: () => {
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("applicationsMarkedAsCriticalFail"),
          });
        },
      });
  };

  showAppAtRiskMembers = async (applicationName: string) => {
    await this.dataService.setDrawerForAppAtRiskMembers(applicationName);
  };

  onCheckboxChange = (applicationName: string, event: Event) => {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedUrls.add(applicationName);
    } else {
      this.selectedUrls.delete(applicationName);
    }
  };
}

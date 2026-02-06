import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  computed,
} from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, debounceTime, startWith } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { createNewSummaryData } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import {
  OrganizationReportSummary,
  ReportStatus,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  IconButtonModule,
  LinkModule,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
  TypographyModule,
  ChipSelectComponent,
} from "@bitwarden/components";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { AppTableRowScrollableM11Component } from "../shared/app-table-row-scrollable-m11.component";
import { ApplicationTableDataSource } from "../shared/app-table-row-scrollable.component";
import { ReportLoadingComponent } from "../shared/report-loading.component";

export const ApplicationFilterOption = {
  All: "all",
  Critical: "critical",
  NonCritical: "nonCritical",
} as const;

export type ApplicationFilterOption =
  (typeof ApplicationFilterOption)[keyof typeof ApplicationFilterOption];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-applications",
  templateUrl: "./applications.component.html",
  imports: [
    ReportLoadingComponent,
    HeaderModule,
    LinkModule,
    SearchModule,
    PipesModule,
    NoItemsModule,
    SharedModule,
    AppTableRowScrollableM11Component,
    IconButtonModule,
    TypographyModule,
    ButtonModule,
    ReactiveFormsModule,
    ChipSelectComponent,
  ],
})
export class ApplicationsComponent implements OnInit {
  destroyRef = inject(DestroyRef);
  private fileDownloadService = inject(FileDownloadService);
  private logService = inject(LogService);

  protected ReportStatusEnum = ReportStatus;
  protected noItemsIcon = Security;

  // Standard properties
  protected readonly dataSource = new TableDataSource<ApplicationTableDataSource>();
  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });

  // Template driven properties
  protected readonly selectedUrls = signal(new Set<string>());
  protected readonly markingAsCritical = signal(false);
  protected readonly applicationSummary = signal<OrganizationReportSummary>(createNewSummaryData());
  protected readonly criticalApplicationsCount = signal(0);
  protected readonly totalApplicationsCount = signal(0);
  protected readonly nonCriticalApplicationsCount = computed(() => {
    return this.totalApplicationsCount() - this.criticalApplicationsCount();
  });

  // filter related properties
  protected readonly selectedFilter = signal<ApplicationFilterOption>(ApplicationFilterOption.All);
  protected selectedFilterObservable = toObservable(this.selectedFilter);
  protected readonly ApplicationFilterOption = ApplicationFilterOption;
  protected readonly filterOptions = computed(() => [
    {
      label: this.i18nService.t("critical", this.criticalApplicationsCount()),
      value: ApplicationFilterOption.Critical,
      icon: " ",
    },
    {
      label: this.i18nService.t("notCritical", this.nonCriticalApplicationsCount()),
      value: ApplicationFilterOption.NonCritical,
      icon: " ",
    },
  ]);
  protected readonly emptyTableExplanation = signal("");

  constructor(
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
  ) {}

  async ngOnInit() {
    this.dataService.enrichedReportData$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (report) => {
        if (report != null) {
          this.applicationSummary.set(report.summaryData);

          // Map the report data to include the iconCipher for each application
          const tableDataWithIcon = report.reportData.map((app) => ({
            ...app,
            iconCipher:
              app.cipherIds.length > 0
                ? this.dataService.getCipherIcon(app.cipherIds[0])
                : undefined,
          }));
          this.dataSource.data = tableDataWithIcon;
          this.totalApplicationsCount.set(report.reportData.length);
        } else {
          this.dataSource.data = [];
        }
      },
      error: () => {
        this.dataSource.data = [];
      },
    });

    this.dataService.criticalReportResults$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (criticalReport) => {
        if (criticalReport != null) {
          this.criticalApplicationsCount.set(criticalReport.reportData.length);
        } else {
          this.criticalApplicationsCount.set(0);
        }
      },
    });

    combineLatest([
      this.searchControl.valueChanges.pipe(startWith("")),
      this.selectedFilterObservable,
    ])
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe(([searchText, selectedFilter]) => {
        let filterFunction = (app: ApplicationTableDataSource) => true;

        if (selectedFilter === ApplicationFilterOption.Critical) {
          filterFunction = (app) => app.isMarkedAsCritical;
        } else if (selectedFilter === ApplicationFilterOption.NonCritical) {
          filterFunction = (app) => !app.isMarkedAsCritical;
        }

        this.dataSource.filter = (app) =>
          filterFunction(app) &&
          app.applicationName.toLowerCase().includes(searchText.toLowerCase());

        // filter selectedUrls down to only applications showing with active filters
        const filteredUrls = new Set<string>();
        this.dataSource.filteredData?.forEach((row) => {
          if (this.selectedUrls().has(row.applicationName)) {
            filteredUrls.add(row.applicationName);
          }
        });
        this.selectedUrls.set(filteredUrls);

        if (this.dataSource?.filteredData?.length === 0) {
          this.emptyTableExplanation.set(this.i18nService.t("noApplicationsMatchTheseFilters"));
        } else {
          this.emptyTableExplanation.set("");
        }
      });
  }

  setFilterApplicationsByStatus(value: ApplicationFilterOption) {
    this.selectedFilter.set(value);
  }

  isMarkedAsCriticalItem(applicationName: string) {
    return this.selectedUrls().has(applicationName);
  }

  markAppsAsCritical = async () => {
    this.markingAsCritical.set(true);
    const count = this.selectedUrls().size;

    this.dataService
      .saveCriticalApplications(Array.from(this.selectedUrls()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("criticalApplicationsMarkedSuccess", count.toString()),
          });
          this.selectedUrls.set(new Set<string>());
          this.markingAsCritical.set(false);
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
    this.selectedUrls.update((selectedUrls) => {
      const nextSelected = new Set(selectedUrls);
      if (isChecked) {
        nextSelected.add(applicationName);
      } else {
        nextSelected.delete(applicationName);
      }
      return nextSelected;
    });
  };

  downloadApplicationsCSV = () => {
    try {
      const data = this.dataSource.filteredData;
      if (!data || data.length === 0) {
        return;
      }

      const exportData = data.map((app) => ({
        applicationName: app.applicationName,
        atRiskPasswordCount: app.atRiskPasswordCount,
        passwordCount: app.passwordCount,
        atRiskMemberCount: app.atRiskMemberCount,
        memberCount: app.memberCount,
        isMarkedAsCritical: app.isMarkedAsCritical
          ? this.i18nService.t("yes")
          : this.i18nService.t("no"),
      }));

      this.fileDownloadService.download({
        fileName: ExportHelper.getFileName("applications"),
        blobData: exportToCSV(exportData, {
          applicationName: this.i18nService.t("application"),
          atRiskPasswordCount: this.i18nService.t("atRiskPasswords"),
          passwordCount: this.i18nService.t("totalPasswords"),
          atRiskMemberCount: this.i18nService.t("atRiskMembers"),
          memberCount: this.i18nService.t("totalMembers"),
          isMarkedAsCritical: this.i18nService.t("criticalBadge"),
        }),
        blobOptions: { type: "text/plain" },
      });
    } catch (error) {
      this.logService.error("Failed to download applications CSV", error);
    }
  };
}

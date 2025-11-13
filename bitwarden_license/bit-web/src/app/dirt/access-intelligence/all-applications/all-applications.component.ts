import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { createNewSummaryData } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import {
  OrganizationReportSummary,
  ReportStatus,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

import {
  ApplicationTableDataSource,
  AppTableRowScrollableComponent,
} from "../shared/app-table-row-scrollable.component";
import { ApplicationsLoadingComponent } from "../shared/risk-insights-loading.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    ReactiveFormsModule,
  ],
})
export class AllApplicationsComponent implements OnInit {
  destroyRef = inject(DestroyRef);

  protected ReportStatusEnum = ReportStatus;
  protected noItemsIcon = Security;

  // Standard properties
  protected readonly dataSource = new TableDataSource<ApplicationTableDataSource>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  // Template driven properties
  protected readonly selectedUrls = signal(new Set<string>());
  protected readonly markingAsCritical = signal(false);
  protected readonly applicationSummary = signal<OrganizationReportSummary>(createNewSummaryData());

  constructor(
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.dataService.enrichedReportData$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (report) => {
        if (report != null) {
          this.applicationSummary.set(report.summaryData);

          // Map the report data to include the iconCipher for each application
          const tableDataWithIcon = report.reportData.map((app) => ({
            ...app,
            iconCipher: this.dataService.getCipherIcon(app.cipherIds[0]),
          }));
          this.dataSource.data = tableDataWithIcon;
        } else {
          this.dataSource.data = [];
        }
      },
      error: () => {
        this.dataSource.data = [];
      },
    });
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
    if (isChecked) {
      this.selectedUrls.update((selectedUrls) => {
        selectedUrls.add(applicationName);
        return selectedUrls;
      });
    } else {
      this.selectedUrls.update((selectedUrls) => {
        selectedUrls.delete(applicationName);
        return selectedUrls;
      });
    }
  };
}

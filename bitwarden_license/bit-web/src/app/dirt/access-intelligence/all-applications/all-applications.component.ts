import { Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, debounceTime, of, switchMap } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  ApplicationHealthReportDetailEnriched,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { createNewSummaryData } from "@bitwarden/bit-common/dirt/reports/risk-insights/helpers";
import {
  OrganizationReportSummary,
  ReportStatus,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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

import { AppTableRowScrollableComponent } from "../shared/app-table-row-scrollable.component";
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
  ],
})
export class AllApplicationsComponent implements OnInit {
  protected dataSource = new TableDataSource<
    ApplicationHealthReportDetailEnriched & { ciphers: CipherView[] }
  >();
  protected selectedUrls: Set<string> = new Set<string>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected organization = new Organization();
  noItemsIcon = Security;
  protected markingAsCritical = false;
  protected applicationSummary: OrganizationReportSummary = createNewSummaryData();
  protected ReportStatusEnum = ReportStatus;

  destroyRef = inject(DestroyRef);

  constructor(
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected dataService: RiskInsightsDataService,
    private router: Router,
    // protected allActivitiesService: AllActivitiesService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    combineLatest([this.dataService.enrichedReportData$, this.dataService.ciphers$])
      .pipe(
        switchMap(([report, ciphers]) => {
          if (!report) {
            return of(null);
          }

          // Map ciphers to each application
          const reportWithCiphers = report.reportData.map((app) => ({
            ...app,
            ciphers: ciphers?.filter((cipher) => app.cipherIds.includes(cipher.id)) ?? [],
          }));
          return of({ ...report, reportData: reportWithCiphers });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (report) => {
          this.applicationSummary = report?.summaryData ?? createNewSummaryData();
          this.dataSource.data = report?.reportData ?? [];
        },
        error: () => {
          this.dataSource.data = [];
        },
      });
  }

  isMarkedAsCriticalItem(applicationName: string) {
    return this.selectedUrls.has(applicationName);
  }

  markAppsAsCritical = async () => {
    this.markingAsCritical = true;
    const count = this.selectedUrls.size;

    this.dataService
      .saveCriticalApplications(Array.from(this.selectedUrls))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("criticalApplicationsMarkedSuccess", count.toString()),
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

import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { catchError, debounceTime, exhaustMap, finalize, of, tap } from "rxjs";

import {
  CriticalAppsService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  ApplicationHealthReportDetailEnriched,
  ApplicationHealthReportSummary,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-models";
import { RiskInsightsEncryptionService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/risk-insights-encryption.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  IconButtonModule,
  Icons,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
  DialogService,
} from "@bitwarden/components";
import { CardComponent } from "@bitwarden/dirt-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { AppTableRowScrollableComponent } from "./app-table-row-scrollable.component";
import { NoDataModalComponent } from "./no-data-modal.component";
import { ApplicationsLoadingComponent } from "./risk-insights-loading.component";

@Component({
  selector: "tools-all-applications",
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
  protected dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
  protected selectedUrls: Set<string> = new Set<string>();
  protected searchControl = new FormControl("", { nonNullable: true });
  noItemsIcon = Icons.Security;
  protected markingAsCritical = false;
  protected applicationSummary: ApplicationHealthReportSummary = {
    totalMemberCount: 0,
    totalAtRiskMemberCount: 0,
    totalApplicationCount: 0,
    totalAtRiskApplicationCount: 0,
  };

  private hasShownNoDataModal = false; // Flag to prevent multiple modals
  private organizationId: string | null = null;
  destroyRef = inject(DestroyRef);

  constructor(
    protected cipherService: CipherService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected configService: ConfigService,
    protected dataService: RiskInsightsDataService,
    protected organizationService: OrganizationService,
    protected reportService: RiskInsightsReportService,
    protected criticalAppsService: CriticalAppsService,
    protected riskInsightsEncryptionService: RiskInsightsEncryptionService,
    protected dialogService: DialogService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");

    if (this.organizationId) {
      this.dataService.reportResults$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((report) => {
          // Check if we already have data in the dataSource (from previous session)
          if (this.dataSource.data.length > 0) {
            this.hasShownNoDataModal = false; // Reset flag since we have data
            return;
          }

          if (report && report.data && report.data.length > 0) {
            this.dataSource.data = report.data;
            // this.applicationSummary = this.reportService.generateApplicationsSummary(report.data);
            this.hasShownNoDataModal = false; // Reset flag when data is available
          } else if (!this.hasShownNoDataModal) {
            // Show modal only once when no report data is available
            void this.showNoDataModal();
          }
        });
    }
  }

  /**
   * Shows a modal prompting users to run a report when no data is available
   */
  private async showNoDataModal(): Promise<void> {
    // Set flag to prevent multiple modals
    this.hasShownNoDataModal = true;

    this.dialogService.open(NoDataModalComponent, {
      data: {
        organizationId: this.organizationId,
        riskInsightsDataService: this.dataService,
      },
      disableClose: false,
    });
  }

  goToCreateNewLoginItem = async () => {
    // TODO: implement
    this.toastService.showToast({
      variant: "warning",
      title: "",
      message: "Not yet implemented",
    });
  };

  markAppsAsCritical = () => {
    of(Array.from(this.selectedUrls))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        exhaustMap((urls) =>
          this.dataService.saveCriticalApps(urls).pipe(
            catchError((error: unknown) => {
              this.toastService.showToast({
                variant: "error",
                title: "",
                message: this.i18nService.t("applicationsMarkedAsCriticalFail"),
              });
              throw error;
            }),
          ),
        ),
        tap(() => {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("applicationsMarkedAsCriticalSuccess"),
          });
        }),
        finalize(() => {
          this.selectedUrls.clear();
          this.markingAsCritical = false;
        }),
      )
      .subscribe();
  };

  showAppAtRiskMembers = async (applicationName: string) => {
    const info = {
      members:
        this.dataSource.data.find((app) => app.applicationName === applicationName)
          ?.atRiskMemberDetails ?? [],
      applicationName,
    };
    this.dataService.setDrawerForAppAtRiskMembers(info, applicationName);
  };

  showOrgAtRiskMembers = async (invokerId: string) => {
    const dialogData = this.reportService.generateAtRiskMemberList(this.dataSource.data);
    this.dataService.setDrawerForOrgAtRiskMembers(dialogData, invokerId);
  };

  showOrgAtRiskApps = async (invokerId: string) => {
    const data = this.reportService.generateAtRiskApplicationList(this.dataSource.data);
    this.dataService.setDrawerForOrgAtRiskApps(data, invokerId);
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

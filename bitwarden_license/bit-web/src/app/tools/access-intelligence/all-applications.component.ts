import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, firstValueFrom, map } from "rxjs";

import {
  ApplicationHealthReportDetail,
  ApplicationHealthReportSummary,
  MemberCipherDetailsApiService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  Icons,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";
import { CardComponent } from "@bitwarden/tools-card";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { ApplicationsLoadingComponent } from "./risk-insights-loading.component";

@Component({
  standalone: true,
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
  ],
  providers: [MemberCipherDetailsApiService, RiskInsightsReportService],
})
export class AllApplicationsComponent implements OnInit {
  protected dataSource = new TableDataSource<ApplicationHealthReportDetail>();
  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });
  private destroyRef = inject(DestroyRef);
  protected loading = true;
  protected organization: Organization;
  noItemsIcon = Icons.Security;
  protected markingAsCritical = false;
  protected applicationSummary: ApplicationHealthReportSummary;

  isCritialAppsFeatureEnabled = false;

  async ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(async (params) => {
          const organizationId = params.get("organizationId");
          this.organization = await firstValueFrom(this.organizationService.get$(organizationId));
          const applicationsReport =
            await this.riskInsightsReportService.generateApplicationsReport(organizationId);
          this.dataSource.data = applicationsReport;
          this.applicationSummary =
            this.riskInsightsReportService.generateApplicationsSummary(applicationsReport);
          this.loading = false;
        }),
      )
      .subscribe();

    this.isCritialAppsFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CriticalApps,
    );
  }

  constructor(
    protected cipherService: CipherService,
    protected riskInsightsReportService: RiskInsightsReportService,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected organizationService: OrganizationService,
    protected configService: ConfigService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  goToCreateNewLoginItem = async () => {
    // TODO: implement
    this.toastService.showToast({
      variant: "warning",
      title: null,
      message: "Not yet implemented",
    });
  };

  markAppsAsCritical = async () => {
    // TODO: Send to API once implemented
    this.markingAsCritical = true;
    return new Promise((resolve) => {
      setTimeout(() => {
        this.selectedIds.clear();
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("appsMarkedAsCritical"),
        });
        resolve(true);
        this.markingAsCritical = false;
      }, 1000);
    });
  };

  trackByFunction(_: number, item: CipherView) {
    return item.id;
  }

  onCheckboxChange(id: number, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }
}

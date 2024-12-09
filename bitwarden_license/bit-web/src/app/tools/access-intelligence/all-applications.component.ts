import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, debounceTime, map, Observable, of, switchMap, tap } from "rxjs";

import {
  MemberCipherDetailsApiService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import {
  ApplicationHealthReportDetail,
  ApplicationHealthReportSummary,
} from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
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

  isCritialAppsFeatureEnabled$: Observable<boolean>;

  ngOnInit() {
    // Combine route parameters and feature flag
    combineLatest([
      this.activatedRoute.paramMap.pipe(
        switchMap((params) => {
          const organizationId = params.get("organizationId");
          if (!organizationId) {
            this.loading = false;
            return of(null);
          }
          return this.organizationService.get$(organizationId).pipe(
            tap((org) => (this.organization = org)),
            switchMap(() =>
              this.riskInsightsReportService.generateApplicationsReport$(organizationId),
            ),
            tap((applicationsReport) => {
              this.dataSource.data = applicationsReport;
              this.applicationSummary =
                this.riskInsightsReportService.generateApplicationsSummary(applicationsReport);
              this.loading = false;
            }),
          );
        }),
      ),
      this.configService.getFeatureFlag$(FeatureFlag.CriticalApps).pipe(),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(([_, featureFlag]) => featureFlag),
        tap((flag) => (this.isCritialAppsFeatureEnabled$ = of(flag))),
      )
      .subscribe();
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

  markAppsAsCritical() {
    // TODO: Send to API once implemented
    this.markingAsCritical = true;
    of(true)
      .pipe(
        debounceTime(1000), // Simulate delay
        tap(() => {
          this.selectedIds.clear();
          this.toastService.showToast({
            variant: "success",
            title: null,
            message: this.i18nService.t("appsMarkedAsCritical"),
          });
          this.markingAsCritical = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

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

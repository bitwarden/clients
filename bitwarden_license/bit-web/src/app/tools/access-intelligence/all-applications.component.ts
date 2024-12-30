import { Component, DestroyRef, OnDestroy, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, map, Observable, of, Subscription } from "rxjs";

import {
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import {
  ApplicationHealthReportDetail,
  ApplicationHealthReportSummary,
} from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
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
})
export class AllApplicationsComponent implements OnInit, OnDestroy {
  protected dataSource = new TableDataSource<ApplicationHealthReportDetail>();
  protected selectedIds: Set<number> = new Set<number>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected loading = true;
  protected organization = {} as Organization;
  noItemsIcon = Icons.Security;
  protected markingAsCritical = false;
  protected applicationSummary = {} as ApplicationHealthReportSummary;
  private subscription = new Subscription();

  destroyRef = inject(DestroyRef);
  isLoading$: Observable<boolean> = of(false);
  isCriticalAppsFeatureEnabled = false;

  async ngOnInit() {
    this.isCriticalAppsFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CriticalApps,
    );

    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");

    if (organizationId) {
      this.organization = await this.organizationService.get(organizationId);
      this.subscription = this.dataService.applications$
        .pipe(
          map((applications) => {
            if (applications) {
              this.dataSource.data = applications;
              this.applicationSummary =
                this.reportService.generateApplicationsSummary(applications);
            }
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
      this.isLoading$ = this.dataService.isLoading$;
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  constructor(
    protected cipherService: CipherService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected configService: ConfigService,
    protected dataService: RiskInsightsDataService,
    protected organizationService: OrganizationService,
    protected reportService: RiskInsightsReportService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  goToCreateNewLoginItem = async () => {
    // TODO: implement
    this.toastService.showToast({
      variant: "warning",
      title: "",
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
          title: "",
          message: this.i18nService.t("appsMarkedAsCritical"),
        });
        resolve(true);
        this.markingAsCritical = false;
      }, 1000);
    });
  };

  trackByFunction(_: number, item: ApplicationHealthReportDetail) {
    return item.applicationName;
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

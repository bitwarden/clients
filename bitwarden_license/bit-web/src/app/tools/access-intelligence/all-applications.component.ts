// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, firstValueFrom, map, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CriticalAppsApiService } from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
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

import { applicationTableMockData } from "./application-table.mock";

@Component({
  standalone: true,
  selector: "tools-all-applications",
  templateUrl: "./all-applications.component.html",
  imports: [HeaderModule, CardComponent, SearchModule, PipesModule, NoItemsModule, SharedModule],
})
export class AllApplicationsComponent implements OnInit {
  protected dataSource = new TableDataSource<any>();
  protected selectedUrls: Set<string> = new Set<string>();
  protected searchControl = new FormControl("", { nonNullable: true });
  private destroyRef = inject(DestroyRef);
  protected loading = false;
  protected organization: Organization;
  noItemsIcon = Icons.Security;
  protected markingAsCritical = false;
  isCritialAppsFeatureEnabled = false;

  // MOCK DATA
  protected mockData = applicationTableMockData;
  protected mockAtRiskMembersCount = 0;
  protected mockAtRiskAppsCount = 0;
  protected mockTotalMembersCount = 0;
  protected mockTotalAppsCount = 0;

  async ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),

        map(async (params) => {
          const organizationId = params.get("organizationId");
          this.organization = await firstValueFrom(this.organizationService.get$(organizationId));
          return params;
          // TODO: use organizationId to fetch data
        }),
        switchMap(async (params) => {
          const organizationId = (await params).get("organizationId");
          return await this.criticalAppsService.getCriticalApps(organizationId);
        }),
      )
      .subscribe((dbCriticalAppRecords) => {
        applicationTableMockData.forEach((data) => {
          data.isMarkedAsCritical = dbCriticalAppRecords.some((app) => app.uri === data.name);
        });
        this.dataSource.data = applicationTableMockData;
      });

    this.isCritialAppsFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CriticalApps,
    );
  }

  constructor(
    protected cipherService: CipherService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected organizationService: OrganizationService,
    protected configService: ConfigService,
    protected criticalAppsService: CriticalAppsApiService,
  ) {
    // this.dataSource.data = applicationTableMockData;
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
    this.markingAsCritical = true;

    await this.criticalAppsService
      .setCriticalApps(this.organization.id, Array.from(this.selectedUrls))
      .then(() => {
        this.dataSource.data.forEach((data) => {
          if (this.selectedUrls.has(data.name)) {
            data.isMarkedAsCritical = true;
          }
        });

        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("appsMarkedAsCritical"),
        });
      })
      .finally(() => {
        this.selectedUrls.clear();
        this.markingAsCritical = false;
      });
  };

  trackByFunction(_: number, item: CipherView) {
    return item.id;
  }

  onCheckboxChange(urlName: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedUrls.add(urlName);
    } else {
      this.selectedUrls.delete(urlName);
    }
  }

  getSelectedUrls = () => Array.from(this.selectedUrls);
}

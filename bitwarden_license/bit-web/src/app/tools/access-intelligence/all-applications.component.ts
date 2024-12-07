import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, firstValueFrom, map, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import {
  CriticalAppsService,
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
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
import { KeyService } from "@bitwarden/key-management";
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
  private flaggedCriticalApps: PasswordHealthReportApplicationsResponse[] = [];

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
          const result = await this.criticalAppsService.getCriticalApps(organizationId);
          const key = await this.keyService.getOrgKey(this.organization.id);
          const flaggedCriticalAppsPromise = result.map(async (r) => {
            const decryptedUrl = await this.encryptService.decryptToUtf8(new EncString(r.uri), key);
            return {
              id: r.id,
              organizationId: r.organizationId,
              uri: decryptedUrl,
            } as PasswordHealthReportApplicationsResponse;
          });
          this.flaggedCriticalApps = await Promise.all(flaggedCriticalAppsPromise);
        }),
      )
      .subscribe();

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
    protected criticalAppsService: CriticalAppsService,
    private keyService: KeyService,
    private encryptService: EncryptService,
  ) {
    this.dataSource.data = applicationTableMockData;
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
    const key = await this.keyService.getOrgKey(this.organization.id);

    // only save records that are not already in the database
    const newEntries = Array.from(this.selectedUrls).filter((url) => {
      return !this.flaggedCriticalApps.some((r) => r.uri === url);
    });

    const criticalAppsPromises = newEntries.map(async (url) => {
      const encryptedUrlName = await this.encryptService.encrypt(url, key);
      return {
        organizationId: this.organization.id,
        url: encryptedUrlName.encryptedString.toString(),
      } as PasswordHealthReportApplicationsRequest;
    });

    const criticalApps = await Promise.all(criticalAppsPromises);

    await this.criticalAppsService
      .setCriticalApps(criticalApps)
      .then((result) => {
        // append to flaggedCriticalApps
        result
          .filter((r) => !this.flaggedCriticalApps.some((f) => f.uri === r.uri))
          .forEach(async (r) => {
            const decryptedUrl = await this.encryptService.decryptToUtf8(new EncString(r.uri), key);
            this.flaggedCriticalApps.push({
              id: r.id,
              organizationId: r.organizationId,
              uri: decryptedUrl,
            } as PasswordHealthReportApplicationsResponse);
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
}

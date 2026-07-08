import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, takeUntil, tap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BerryComponent, ChipFilterComponent, DialogService } from "@bitwarden/components";
import {
  CipherFormConfigService,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
} from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared";
import { OrganizationBadgeModule } from "../../../../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../../../vault/individual-vault/pipes/pipes.module";
import { AdminConsoleCipherFormConfigService } from "../../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { UnsecuredWebsitesReportComponent as BaseUnsecuredWebsitesReportComponent } from "../unsecured-websites-report.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-unsecured-websites-report",
  templateUrl: "../unsecured-websites-report.component.html",
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: AdminConsoleCipherFormConfigService,
    },
    AdminConsoleCipherFormConfigService,
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
  ],
  imports: [
    SharedModule,
    HeaderModule,
    OrganizationBadgeModule,
    PipesModule,
    ChipFilterComponent,
    BerryComponent,
  ],
})
export class UnsecuredWebsitesReportComponent
  extends BaseUnsecuredWebsitesReportComponent
  implements OnInit
{
  private manageableCipherIds = new Set<string>();
  private sharedCollectionIds = new Set<string>();

  constructor(
    cipherService: CipherService,
    dialogService: DialogService,
    private route: ActivatedRoute,
    organizationService: OrganizationService,
    protected accountService: AccountService,
    protected logService: LogService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    collectionService: CollectionService,
    cipherFormConfigService: CipherFormConfigService,
    adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
  ) {
    super(
      cipherService,
      organizationService,
      dialogService,
      accountService,
      passwordRepromptService,
      i18nService,
      syncService,
      collectionService,
      cipherFormConfigService,
      adminConsoleCipherFormConfigService,
      logService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    this.logService.info("[UnsecuredWebsitesOrganizationReport] org setup start");
    this.route.parent?.parent?.params
      .pipe(
        tap(async (params) => {
          this.logService.info("[UnsecuredWebsitesOrganizationReport] route params received");

          try {
            const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
            this.organization = await firstValueFrom(
              this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
            );
            this.logService.info(
              `[UnsecuredWebsitesOrganizationReport] organization context loaded found=${this.organization != null}`,
            );

            const manageableCiphers = await this.cipherService.getAll(userId);
            this.manageableCipherIds = new Set(manageableCiphers.map((c) => c.id));
            this.logService.info(
              `[UnsecuredWebsitesOrganizationReport] manageable ciphers loaded count=${this.manageableCipherIds.size}`,
            );

            const collections = await firstValueFrom(
              this.collectionService.decryptedCollections$(userId),
            );
            this.sharedCollectionIds = new Set(
              collections
                .filter((c) => !c.isDefaultCollection && c.organizationId === this.organization?.id)
                .map((c) => c.id as string),
            );
            this.logService.info(
              `[UnsecuredWebsitesOrganizationReport] shared collections loaded count=${this.sharedCollectionIds.size}`,
            );

            await super.ngOnInit();
            this.logService.info("[UnsecuredWebsitesOrganizationReport] org setup complete");
          } catch (e) {
            this.logService.error("[UnsecuredWebsitesOrganizationReport] org setup failure", e);
            throw e;
          }
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe();
  }

  async getAllCiphers(): Promise<CipherView[]> {
    this.logService.info("[UnsecuredWebsitesOrganizationReport] cipher fetch start");

    if (this.organization) {
      try {
        const ciphers = await this.cipherService.getAllFromApiForOrganization(
          this.organization.id,
          true,
        );
        this.logService.info(
          `[UnsecuredWebsitesOrganizationReport] cipher fetch complete count=${ciphers.length}`,
        );
        return ciphers;
      } catch (e) {
        this.logService.error("[UnsecuredWebsitesOrganizationReport] cipher fetch failure", e);
        throw e;
      }
    }

    this.logService.info(
      "[UnsecuredWebsitesOrganizationReport] cipher fetch skipped reason=no organization",
    );

    return [];
  }

  protected canManageCipher(c: CipherView): boolean {
    if (
      CipherViewLikeUtils.isUnassigned(c) ||
      !c.collectionIds?.some((id) => this.sharedCollectionIds.has(id))
    ) {
      return false;
    }
    if (this.organization?.allowAdminAccessToAllCollectionItems) {
      return true;
    }
    return this.manageableCipherIds.has(c.id);
  }
}

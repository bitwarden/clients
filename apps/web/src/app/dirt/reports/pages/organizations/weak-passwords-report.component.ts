import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, takeUntil, tap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BerryComponent, ChipFilterComponent, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
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
import { WeakPasswordsReportComponent as BaseWeakPasswordsReportComponent } from "../weak-passwords-report.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-weak-passwords-report",
  templateUrl: "../weak-passwords-report.component.html",
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
export class WeakPasswordsReportComponent
  extends BaseWeakPasswordsReportComponent
  implements OnInit
{
  private manageableCipherIds = new Set<string>();
  private sharedCollectionIds = new Set<string>();

  constructor(
    cipherService: CipherService,
    passwordStrengthService: PasswordStrengthServiceAbstraction,
    dialogService: DialogService,
    private route: ActivatedRoute,
    organizationService: OrganizationService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    cipherFormConfigService: CipherFormConfigService,
    protected accountService: AccountService,
    adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
    private collectionService: CollectionService,
    protected logService: LogService,
  ) {
    super(
      cipherService,
      passwordStrengthService,
      organizationService,
      dialogService,
      accountService,
      passwordRepromptService,
      i18nService,
      syncService,
      cipherFormConfigService,
      adminConsoleCipherFormConfigService,
      logService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    this.route.parent?.parent?.params
      .pipe(
        tap(async (params) => {
          try {
            const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
            this.organization = await firstValueFrom(
              this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
            );
            this.logService.info(
              `[WeakPasswordsReport] Initializing for organization "${this.organization?.id ?? params.organizationId}"`,
            );

            const manageableCiphers = await this.cipherService.getAll(userId);
            this.logService.info(
              `[WeakPasswordsReport] User has access to ${manageableCiphers.length} ciphers in organization"`,
            );
            this.logService.info(`[WeakPasswordsReport] Fetching collections for organization"`);
            this.manageableCipherIds = new Set(manageableCiphers.map((c) => c.id));
            const collections = await firstValueFrom(
              this.collectionService.decryptedCollections$(userId),
            );
            this.sharedCollectionIds = new Set(
              collections
                .filter((c) => !c.isDefaultCollection && c.organizationId === this.organization?.id)
                .map((c) => c.id as string),
            );
            this.logService.info(
              `[WeakPasswordsReport] User has access to ${this.sharedCollectionIds.size} shared collections in organization"`,
            );
            await super.ngOnInit();
          } catch (e) {
            // Re-throwing here would surface an unhandled promise rejection rather than
            // propagating through the observable stream, so we log and swallow instead.
            this.logService.error(
              `[WeakPasswordsReport] Failed to initialize for organization "${params.organizationId}"`,
              e,
            );
          }
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe();
  }

  async getAllCiphers(): Promise<CipherView[]> {
    this.logService.info(
      `[WeakPasswordsReport] Fetching ciphers for organization ${this.organization?.id ?? "N/A"}`,
    );
    if (this.organization) {
      try {
        const ciphers = await this.cipherService.getAllFromApiForOrganization(
          this.organization.id,
          true,
        );
        this.logService.info(
          `[WeakPasswordsReport] Fetched ${ciphers.length} ciphers for organization "${this.organization.id}"`,
        );
        return ciphers;
      } catch (e) {
        this.logService.error(
          `[WeakPasswordsReport] Failed to fetch ciphers for organization "${this.organization?.id ?? "N/A"}"`,
          e,
        );
        throw e;
      }
    }
    return [];
  }

  canManageCipher(c: CipherView): boolean {
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

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService, CipherFormConfigService } from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared";
import { OrganizationBadgeModule } from "../../../../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../../../vault/individual-vault/pipes/pipes.module";
import { RoutedVaultFilterBridgeService } from "../../../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
import { AdminConsoleCipherFormConfigService } from "../../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { ExposedPasswordsReportComponent as BaseExposedPasswordsReportComponent } from "../exposed-passwords-report.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-exposed-passwords-report",
  templateUrl: "../exposed-passwords-report.component.html",
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: AdminConsoleCipherFormConfigService,
    },
    AdminConsoleCipherFormConfigService,
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
  ],
  imports: [SharedModule, HeaderModule, OrganizationBadgeModule, PipesModule],
})
export class ExposedPasswordsReportComponent
  extends BaseExposedPasswordsReportComponent
  implements OnInit
{
  manageableCiphers: Cipher[];

  constructor(
    cipherService: CipherService,
    auditService: AuditService,
    dialogService: DialogService,
    organizationService: OrganizationService,
    protected accountService: AccountService,
    private route: ActivatedRoute,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    cipherFormService: CipherFormConfigService,
    adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
  ) {
    super(
      cipherService,
      auditService,
      organizationService,
      dialogService,
      accountService,
      passwordRepromptService,
      i18nService,
      syncService,
      cipherFormService,
      adminConsoleCipherFormConfigService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(params.organizationId)),
      );
      this.manageableCiphers = await this.cipherService.getAll(userId);
    });
  }

  getAllCiphers(): Promise<CipherView[]> {
    return this.cipherService.getAllFromApiForOrganization(this.organization.id, true);
  }

  canManageCipher(c: CipherView): boolean {
    if (c.collectionIds.length === 0) {
      return true;
    }
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { RoutedVaultFilterBridgeService } from "../../../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
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
  standalone: false,
})
export class UnsecuredWebsitesReportComponent
  extends BaseUnsecuredWebsitesReportComponent
  implements OnInit
{
  // Contains a list of ciphers, the user running the report, can manage
  private manageableCiphers: Cipher[];

  constructor(
    cipherService: CipherService,
    dialogService: DialogService,
    private route: ActivatedRoute,
    organizationService: OrganizationService,
    protected accountService: AccountService,
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
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(params.organizationId)),
      );
      this.manageableCiphers = await this.cipherService.getAll(userId);
      await super.ngOnInit();
    });
  }

  getAllCiphers(): Promise<CipherView[]> {
    return this.cipherService.getAllFromApiForOrganization(this.organization.id, true);
  }

  protected canManageCipher(c: CipherView): boolean {
    if (c.collectionIds.length === 0) {
      return true;
    }
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}

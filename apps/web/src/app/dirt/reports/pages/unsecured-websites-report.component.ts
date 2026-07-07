import { Component, OnInit } from "@angular/core";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import {
  CipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-unsecured-websites-report",
  templateUrl: "unsecured-websites-report.component.html",
  standalone: false,
})
export class UnsecuredWebsitesReportComponent extends CipherReportComponent implements OnInit {
  disabled = true;

  constructor(
    protected cipherService: CipherService,
    protected organizationService: OrganizationService,
    dialogService: DialogService,
    accountService: AccountService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    protected collectionService: CollectionService,
    cipherFormConfigService: CipherFormConfigService,
    adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
    protected logService: LogService,
  ) {
    super(
      cipherService,
      dialogService,
      passwordRepromptService,
      organizationService,
      accountService,
      i18nService,
      syncService,
      cipherFormConfigService,
      adminConsoleCipherFormConfigService,
      logService,
    );
  }

  async ngOnInit() {
    this.logService.info("[UnsecuredWebsitesReport] load start");
    try {
      await super.load();
      this.logService.info("[UnsecuredWebsitesReport] load success");
    } catch (e) {
      this.logService.error("[UnsecuredWebsitesReport] load failure", e);
      throw e;
    }
  }

  async setCiphers() {
    this.logService.info("[UnsecuredWebsitesReport] analysis start");
    try {
      const allCiphers = await this.getAllCiphers();
      this.filterStatus = [0];

      let eligibleCipherCount = 0;
      const unsecuredCiphers = allCiphers.filter((c) => {
        if (
          c.type === CipherType.Login &&
          c.login.hasUris &&
          !c.isDeleted &&
          (this.organization || c.edit)
        ) {
          eligibleCipherCount++;
        }

        return this.cipherContainsUnsecured(c);
      });

      this.logService.info(
        `[UnsecuredWebsitesReport] analysis candidates total=${allCiphers.length} eligible=${eligibleCipherCount}`,
      );
      this.logService.info(
        `[UnsecuredWebsitesReport] analysis complete unsecured=${unsecuredCiphers.length}`,
      );

      this.filterCiphersByOrg(unsecuredCiphers);
      this.logService.info(
        `[UnsecuredWebsitesReport] filter complete displayed=${this.ciphers.length}`,
      );
    } catch (e) {
      this.logService.error("[UnsecuredWebsitesReport] analysis failure", e);
      throw e;
    }
  }

  /**
   * Cipher needs to be a Login type, contain Uris, and not be deleted
   * @param cipher Current cipher with unsecured uri
   */
  private cipherContainsUnsecured(cipher: CipherView): boolean {
    if (
      cipher.type !== CipherType.Login ||
      !cipher.login.hasUris ||
      cipher.isDeleted ||
      (!this.organization && !cipher.edit)
    ) {
      return false;
    }

    const containsUnsecured = cipher.login.uris.some(
      (u: any) => u.uri != null && u.uri.indexOf("http://") === 0,
    );
    return containsUnsecured;
  }

  /**
   * Provides a way to determine if someone with permissions to run an organizational report is also able to view/edit ciphers within the results
   * Default to true for indivduals running reports on their own vault.
   * @param c CipherView
   * @returns boolean
   */
  protected canManageCipher(c: CipherView): boolean {
    // this will only ever be false from the org view;
    return true;
  }

  async determinedUpdatedCipherReportStatus(
    result: VaultItemDialogResult,
    updatedCipherView: CipherView,
  ): Promise<CipherView | null> {
    this.logService.info(`[UnsecuredWebsitesReport] update check start result=${result}`);

    if (result === VaultItemDialogResult.Deleted) {
      this.logService.info("[UnsecuredWebsitesReport] update check complete action=deleted");
      return null;
    }

    // If the cipher still contains unsecured URIs, return it as is
    if (this.cipherContainsUnsecured(updatedCipherView)) {
      this.logService.info("[UnsecuredWebsitesReport] update check complete action=retain");
      return updatedCipherView;
    }

    this.logService.info("[UnsecuredWebsitesReport] update check complete action=remove");

    return null;
  }
}

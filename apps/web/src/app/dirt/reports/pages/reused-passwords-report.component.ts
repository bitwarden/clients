// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";

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
  selector: "app-reused-passwords-report",
  templateUrl: "reused-passwords-report.component.html",
  standalone: false,
})
export class ReusedPasswordsReportComponent extends CipherReportComponent implements OnInit {
  ciphersToCheckForReusedPasswords: CipherView[] = [];
  passwordUseMap: Map<string, number>;
  disabled = true;

  constructor(
    protected cipherService: CipherService,
    protected organizationService: OrganizationService,
    dialogService: DialogService,
    accountService: AccountService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
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
    this.logService.info("[ReusedPasswordsReport] load start");
    try {
      await super.load();
      this.logService.info("[ReusedPasswordsReport] load success");
    } catch (e) {
      this.logService.error("[ReusedPasswordsReport] load failure", e);
      throw e;
    }
  }

  async setCiphers() {
    this.logService.info("[ReusedPasswordsReport] analysis start");
    try {
      this.ciphersToCheckForReusedPasswords = await this.getAllCiphers();
      this.logService.info(
        `[ReusedPasswordsReport] analysis candidates total=${this.ciphersToCheckForReusedPasswords.length}`,
      );

      const reusedPasswordCiphers = await this.checkCiphersForReusedPasswords(
        this.ciphersToCheckForReusedPasswords,
      );
      this.logService.info(
        `[ReusedPasswordsReport] analysis complete reused=${reusedPasswordCiphers.length}`,
      );

      this.filterCiphersByOrg(reusedPasswordCiphers);
      this.logService.info(
        `[ReusedPasswordsReport] filter complete displayed=${this.ciphers.length}`,
      );
    } catch (e) {
      this.logService.error("[ReusedPasswordsReport] analysis failure", e);
      throw e;
    }
  }

  protected async checkCiphersForReusedPasswords(ciphers: CipherView[]): Promise<CipherView[]> {
    const ciphersWithPasswords: CipherView[] = [];
    this.passwordUseMap = new Map<string, number>();
    this.filterStatus = [0];
    let eligibleCipherCount = 0;

    ciphers.forEach((ciph) => {
      const { type, login, isDeleted, edit, viewPassword } = ciph;
      if (
        type !== CipherType.Login ||
        login.password == null ||
        login.password === "" ||
        isDeleted ||
        (!this.organization && !edit) ||
        !viewPassword
      ) {
        return;
      }

      eligibleCipherCount++;
      ciphersWithPasswords.push(ciph);
      if (this.passwordUseMap.has(login.password)) {
        this.passwordUseMap.set(login.password, this.passwordUseMap.get(login.password) + 1);
      } else {
        this.passwordUseMap.set(login.password, 1);
      }
    });
    const reusedPasswordCiphers = ciphersWithPasswords.filter(
      (c) =>
        this.passwordUseMap.has(c.login.password) && this.passwordUseMap.get(c.login.password) > 1,
    );

    this.logService.info(
      `[ReusedPasswordsReport] password analysis eligible=${eligibleCipherCount} unique=${this.passwordUseMap.size} reused=${reusedPasswordCiphers.length}`,
    );

    return reusedPasswordCiphers;
  }

  protected canManageCipher(c: CipherView): boolean {
    // this will only ever be false from an organization view
    return true;
  }

  async determinedUpdatedCipherReportStatus(
    result: VaultItemDialogResult,
    updatedCipherView: CipherView,
  ): Promise<CipherView | null> {
    this.logService.info(`[ReusedPasswordsReport] update check start result=${result}`);

    if (result === VaultItemDialogResult.Deleted) {
      this.ciphersToCheckForReusedPasswords = this.ciphersToCheckForReusedPasswords.filter(
        (c) => c.id !== updatedCipherView.id,
      );
      this.logService.info("[ReusedPasswordsReport] update check complete action=deleted");
      return null;
    }

    // recalculate the reused passwords after an update
    // if a password was changed, it could affect reused counts of other ciphers

    // find the cipher in our list and update it
    const index = this.ciphersToCheckForReusedPasswords.findIndex(
      (c) => c.id === updatedCipherView.id,
    );

    if (index !== -1) {
      this.ciphersToCheckForReusedPasswords[index] = updatedCipherView;
    } else {
      this.logService.warning("[ReusedPasswordsReport] update check warning cipher not found");
    }

    // Re-check the passwords for reused passwords for all ciphers
    const reusedPasswordCiphers = await this.checkCiphersForReusedPasswords(
      this.ciphersToCheckForReusedPasswords,
    );

    // set the updated ciphers list to the filtered reused passwords
    this.filterCiphersByOrg(reusedPasswordCiphers);
    this.logService.info(
      `[ReusedPasswordsReport] update check complete action=recalculated displayed=${this.ciphers.length}`,
    );

    // return the updated cipher view
    return updatedCipherView;
  }
}

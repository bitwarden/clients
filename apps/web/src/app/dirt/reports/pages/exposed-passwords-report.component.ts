import { Component, OnInit } from "@angular/core";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
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

type ReportResult = CipherView & { exposedXTimes: number };

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-exposed-passwords-report",
  templateUrl: "exposed-passwords-report.component.html",
  standalone: false,
})
export class ExposedPasswordsReportComponent extends CipherReportComponent implements OnInit {
  disabled = true;

  constructor(
    protected cipherService: CipherService,
    protected auditService: AuditService,
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
    this.logService.info("[ExposedPasswordsReport] load start");
    try {
      await super.load();
      this.logService.info("[ExposedPasswordsReport] load success");
    } catch (e) {
      this.logService.error("[ExposedPasswordsReport] load failure", e);
      throw e;
    }
  }

  async setCiphers() {
    this.logService.info("[ExposedPasswordsReport] analysis start");
    try {
      const allCiphers = await this.getAllCiphers();
      const exposedPasswordCiphers: ReportResult[] = [];
      const promises: Promise<void>[] = [];
      let eligibleCipherCount = 0;
      this.filterStatus = [0];

      allCiphers.forEach((ciph) => {
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
        const promise = this.isPasswordExposed(ciph).then((result) => {
          if (result) {
            exposedPasswordCiphers.push(result);
          }
        });
        promises.push(promise);
      });
      this.logService.info(
        `[ExposedPasswordsReport] analysis candidates total=${allCiphers.length} eligible=${eligibleCipherCount}`,
      );

      await Promise.all(promises);
      this.logService.info(
        `[ExposedPasswordsReport] analysis complete exposed=${exposedPasswordCiphers.length}`,
      );

      this.filterCiphersByOrg(exposedPasswordCiphers);
      this.logService.info(
        `[ExposedPasswordsReport] filter complete displayed=${this.ciphers.length}`,
      );
      this.dataSource.sort = { column: "exposedXTimes", direction: "desc" };
    } catch (e) {
      this.logService.error("[ExposedPasswordsReport] analysis failure", e);
      throw e;
    }
  }

  private async isPasswordExposed(cv: CipherView): Promise<ReportResult | null> {
    const { login } = cv;
    if (login.password == null) {
      return null;
    }

    try {
      return await this.auditService.passwordLeaked(login.password).then((exposedCount) => {
        if (exposedCount > 0) {
          return { ...cv, exposedXTimes: exposedCount } as ReportResult;
        }
        return null;
      });
    } catch (e) {
      this.logService.error("[ExposedPasswordsReport] leak check failure", e);
      throw e;
    }
  }

  protected canManageCipher(c: CipherView): boolean {
    // this will only ever be false from the org view;
    return true;
  }

  async determinedUpdatedCipherReportStatus(
    result: VaultItemDialogResult,
    updatedCipherView: CipherView,
  ): Promise<CipherView | null> {
    this.logService.info(`[ExposedPasswordsReport] update check start result=${result}`);

    if (result === VaultItemDialogResult.Deleted) {
      this.logService.info("[ExposedPasswordsReport] update check complete action=deleted");
      return null;
    }

    const exposedReportResult = await this.isPasswordExposed(updatedCipherView);
    this.logService.info(
      `[ExposedPasswordsReport] update check complete action=${exposedReportResult ? "retain" : "remove"}`,
    );

    return exposedReportResult;
  }
}

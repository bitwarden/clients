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
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";
import { VaultItemDialogResult } from "@bitwarden/web-vault/app/vault/components/vault-item-dialog/vault-item-dialog.component";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

type ReportResult = CipherView & { exposedXTimes: number };

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
    );
  }

  async ngOnInit() {
    await super.load();
  }

  async setCiphers() {
    const allCiphers = await this.getAllCiphers();
    const exposedPasswordCiphers: ReportResult[] = [];
    const promises: Promise<void>[] = [];
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

      const promise = this.isPasswordExposed(ciph).then((result) => {
        if (result) {
          exposedPasswordCiphers.push(result);
        }
      });
      promises.push(promise);
    });
    await Promise.all(promises);

    this.filterCiphersByOrg(exposedPasswordCiphers);
    this.dataSource.sort = { column: "exposedXTimes", direction: "desc" };
  }

  private async isPasswordExposed(cv: CipherView): Promise<ReportResult | null> {
    const { login } = cv;
    return await this.auditService.passwordLeaked(login.password).then((exposedCount) => {
      if (exposedCount > 0) {
        return { ...cv, exposedXTimes: exposedCount } as ReportResult;
      }
      return null;
    });
  }

  protected canManageCipher(c: CipherView): boolean {
    // this will only ever be false from the org view;
    return true;
  }

  async determinedUpdatedCipherReportStatus(
    result: VaultItemDialogResult,
    updatedCipherView: CipherView,
  ): Promise<CipherView | null> {
    return await this.isPasswordExposed(updatedCipherView);
  }
}

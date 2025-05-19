// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";
import { VaultItemDialogResult } from "@bitwarden/web-vault/app/vault/components/vault-item-dialog/vault-item-dialog.component";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

@Component({
  selector: "app-inactive-two-factor-report",
  templateUrl: "inactive-two-factor-report.component.html",
  standalone: false,
})
export class InactiveTwoFactorReportComponent extends CipherReportComponent implements OnInit {
  services = new Map<string, string>();
  cipherDocs = new Map<string, string>();
  disabled = true;

  constructor(
    protected cipherService: CipherService,
    protected organizationService: OrganizationService,
    dialogService: DialogService,
    accountService: AccountService,
    private logService: LogService,
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
    try {
      await this.load2fa();
    } catch (e) {
      this.logService.error(e);
    }

    if (this.services.size > 0) {
      const allCiphers = await this.getAllCiphers();
      const inactive2faCiphers: CipherView[] = [];
      const docs = new Map<string, string>();
      this.filterStatus = [0];

      allCiphers.forEach((ciph) => {
        const [docFor2fa, isInactive2faCipher] = this.isInactive2faCipher(ciph);

        if (isInactive2faCipher) {
          inactive2faCiphers.push(ciph);
          if (docFor2fa !== "") {
            docs.set(ciph.id, docFor2fa);
          }
        }
      });

      this.filterCiphersByOrg(inactive2faCiphers);
      this.cipherDocs = docs;
    }
  }

  private isInactive2faCipher(cipher: CipherView): [string, boolean] {
    let docFor2fa: string = "";
    let isInactive2faCipher: boolean = false;

    const { type, login, isDeleted, edit, viewPassword } = cipher;
    if (
      type !== CipherType.Login ||
      (login.totp != null && login.totp !== "") ||
      !login.hasUris ||
      isDeleted ||
      (!this.organization && !edit) ||
      !viewPassword
    ) {
      return [docFor2fa, isInactive2faCipher];
    }

    for (let i = 0; i < login.uris.length; i++) {
      const u = login.uris[i];
      if (u.uri != null && u.uri !== "") {
        const uri = u.uri.replace("www.", "");
        const domain = Utils.getDomain(uri);
        if (domain != null && this.services.has(domain)) {
          if (this.services.get(domain) != null) {
            docFor2fa = this.services.get(domain) || "";
          }
          isInactive2faCipher = true;
          break;
        }
      }
    }
    return [docFor2fa, isInactive2faCipher];
  }

  private async load2fa() {
    if (this.services.size > 0) {
      return;
    }
    const response = await fetch(new Request("https://api.2fa.directory/v3/totp.json"));
    if (response.status !== 200) {
      throw new Error();
    }
    const responseJson = await response.json();
    for (const service of responseJson) {
      const serviceData = service[1];
      if (serviceData.domain == null) {
        continue;
      }
      if (serviceData.documentation == null) {
        continue;
      }
      if (serviceData["additional-domains"] != null) {
        for (const additionalDomain of serviceData["additional-domains"]) {
          this.services.set(additionalDomain, serviceData.documentation);
        }
      }
      this.services.set(serviceData.domain, serviceData.documentation);
    }
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
    if (result === VaultItemDialogResult.Deleted) {
      return null;
    }

    const [docFor2fa, isInactive2faCipher] = this.isInactive2faCipher(updatedCipherView);

    if (isInactive2faCipher) {
      this.cipherDocs.set(updatedCipherView.id, docFor2fa);
      return updatedCipherView;
    }

    return null;
  }
}

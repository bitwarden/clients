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

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

@Component({
  selector: "app-inactive-two-factor-report",
  templateUrl: "inactive-two-factor-report.component.html",
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
        const { type, login, isDeleted, edit, id, viewPassword } = ciph;
        if (
          type !== CipherType.Login ||
          (login.totp != null && login.totp !== "") ||
          !login.hasUris ||
          isDeleted ||
          (!this.organization && !edit) ||
          !viewPassword
        ) {
          return;
        }

        for (let i = 0; i < login.uris.length; i++) {
          const u = login.uris[i];
          if (u.uri != null && u.uri !== "") {
            const uri = u.uri.replace("www.", "");
            const domain = Utils.getDomain(uri);
            if (domain != null && this.services.has(domain)) {
              if (this.services.get(domain) != null) {
                docs.set(id, this.services.get(domain));
              }
              // If the uri is in the 2fa list. Add the cipher to the inactive
              // collection. No need to check any additional uris for the cipher.
              inactive2faCiphers.push(ciph);
              return;
            }
          }
        }
      });

      this.filterCiphersByOrg(inactive2faCiphers);
      this.cipherDocs = docs;
    }
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
}

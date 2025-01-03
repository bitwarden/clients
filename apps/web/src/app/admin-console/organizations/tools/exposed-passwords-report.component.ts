// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService, CipherFormConfigService } from "@bitwarden/vault";

// eslint-disable-next-line no-restricted-imports
import { ExposedPasswordsReportComponent as BaseExposedPasswordsReportComponent } from "../../../tools/reports/pages/exposed-passwords-report.component";

@Component({
  selector: "app-org-exposed-passwords-report",
  templateUrl: "../../../tools/reports/pages/exposed-passwords-report.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
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
    private route: ActivatedRoute,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    cipherFormService: CipherFormConfigService,
  ) {
    super(
      cipherService,
      auditService,
      organizationService,
      dialogService,
      passwordRepromptService,
      i18nService,
      syncService,
      cipherFormService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organization = await this.organizationService.get(params.organizationId);
      this.manageableCiphers = await this.cipherService.getAll();
    });
  }

  getAllCiphers(): Promise<CipherView[]> {
    return this.cipherService.getAllFromApiForOrganization(this.organization.id);
  }

  canManageCipher(c: CipherView): boolean {
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}

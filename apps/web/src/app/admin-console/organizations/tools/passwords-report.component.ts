import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

// eslint-disable-next-line no-restricted-imports
import { PasswordsReportComponent as BasePasswordsReportComponent } from "../../../tools/reports/pages/passwords-report.component";

@Component({
  standalone: true,
  selector: "app-passwords-report",
  templateUrl: "../../../tools/reports/pages/passwords-report.component.html",
})
export class PasswordsReportComponent extends BasePasswordsReportComponent implements OnInit {
  manageableCiphers: Cipher[];

  constructor(
    cipherService: CipherService,
    passwordStrengthService: PasswordStrengthServiceAbstraction,
    private route: ActivatedRoute,
    organizationService: OrganizationService,
    protected auditService: AuditService,
    modalService: ModalService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
  ) {
    super(
      cipherService,
      passwordStrengthService,
      organizationService,
      auditService,
      modalService,
      passwordRepromptService,
      i18nService,
      syncService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent?.parent?.params.subscribe(async (params) => {
      this.organization = await this.organizationService.get(params.organizationId);
      this.manageableCiphers = await this.cipherService.getAll();
      await super.ngOnInit();
    });
  }

  getAllCiphers(): Promise<CipherView[]> {
    return this.cipherService.getAllFromApiForOrganization(this.organization.id);
  }

  canManageCipher(c: CipherView): boolean {
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}

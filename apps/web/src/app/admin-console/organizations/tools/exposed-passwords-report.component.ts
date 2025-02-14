// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ModalService } from "@bitwarden/angular/services/modal.service";
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
import { PasswordRepromptService } from "@bitwarden/vault";

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
    modalService: ModalService,
    organizationService: OrganizationService,
    protected accountService: AccountService,
    private route: ActivatedRoute,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
  ) {
    super(
      cipherService,
      auditService,
      organizationService,
      accountService,
      modalService,
      passwordRepromptService,
      i18nService,
      syncService,
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
    return this.cipherService.getAllFromApiForOrganization(this.organization.id);
  }

  canManageCipher(c: CipherView): boolean {
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

// eslint-disable-next-line no-restricted-imports
import { InactiveTwoFactorReportComponent as BaseInactiveTwoFactorReportComponent } from "../../../tools/reports/pages/inactive-two-factor-report.component";

@Component({
  selector: "app-inactive-two-factor-report",
  templateUrl: "../../../tools/reports/pages/inactive-two-factor-report.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class InactiveTwoFactorReportComponent
  extends BaseInactiveTwoFactorReportComponent
  implements OnInit
{
  constructor(
    cipherService: CipherService,
    dialogService: DialogService,
    private route: ActivatedRoute,
    logService: LogService,
    passwordRepromptService: PasswordRepromptService,
    organizationService: OrganizationService,
    i18nService: I18nService,
    syncService: SyncService,
    cipherFormConfigService: CipherFormConfigService,
  ) {
    super(
      cipherService,
      organizationService,
      dialogService,
      logService,
      passwordRepromptService,
      i18nService,
      syncService,
      cipherFormConfigService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organization = await this.organizationService.get(params.organizationId);
      await super.ngOnInit();
    });
  }

  getAllCiphers(): Promise<CipherView[]> {
    return this.cipherService.getAllFromApiForOrganization(this.organization.id);
  }
}

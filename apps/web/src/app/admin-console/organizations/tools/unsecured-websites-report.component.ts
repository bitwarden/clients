// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

// eslint-disable-next-line no-restricted-imports
import { UnsecuredWebsitesReportComponent as BaseUnsecuredWebsitesReportComponent } from "../../../tools/reports/pages/unsecured-websites-report.component";

@Component({
  selector: "app-unsecured-websites-report",
  templateUrl: "../../../tools/reports/pages/unsecured-websites-report.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class UnsecuredWebsitesReportComponent
  extends BaseUnsecuredWebsitesReportComponent
  implements OnInit
{
  constructor(
    cipherService: CipherService,
    modalService: ModalService,
    private route: ActivatedRoute,
    organizationService: OrganizationService,
    protected accountService: AccountService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    collectionService: CollectionService,
  ) {
    super(
      cipherService,
      organizationService,
      accountService,
      modalService,
      passwordRepromptService,
      i18nService,
      syncService,
      collectionService,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(params.organizationId)),
      );
      await super.ngOnInit();
    });
  }

  getAllCiphers(): Promise<CipherView[]> {
    return this.cipherService.getAllFromApiForOrganization(this.organization.id);
  }
}

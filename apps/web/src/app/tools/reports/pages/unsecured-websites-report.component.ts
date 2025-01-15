import { Component, OnInit } from "@angular/core";

import { CollectionService, Collection } from "@bitwarden/admin-console/common";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

import { CipherReportComponent } from "./cipher-report.component";

@Component({
  selector: "app-unsecured-websites-report",
  templateUrl: "unsecured-websites-report.component.html",
})
export class UnsecuredWebsitesReportComponent extends CipherReportComponent implements OnInit {
  disabled = true;

  constructor(
    protected cipherService: CipherService,
    protected organizationService: OrganizationService,
    accountService: AccountService,
    modalService: ModalService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    private collectionService: CollectionService,
  ) {
    super(
      cipherService,
      modalService,
      passwordRepromptService,
      organizationService,
      accountService,
      i18nService,
      syncService,
    );
  }

  async ngOnInit() {
    await super.load();
  }

  async setCiphers() {
    const allCiphers = await this.getAllCiphers();
    const allCollections = await this.collectionService.getAll();
    this.filterStatus = [0];

    const unsecuredCiphers = allCiphers.filter((c) => {
      const containsUnsecured = this.cipherContainsUnsecured(c);
      if (containsUnsecured === false) {
        return false;
      }

      const canView = this.canView(c, allCollections);
      return canView;
    });

    this.filterCiphersByOrg(unsecuredCiphers);
  }

  /**
   * Cipher needs to be a Login type, contain Uris, and not be deleted
   * @param cipher Current cipher with unsecured uri
   */
  private cipherContainsUnsecured(cipher: CipherView): boolean {
    if (cipher.type !== CipherType.Login || !cipher.login.hasUris || cipher.isDeleted) {
      return false;
    }

    const containsUnsecured = cipher.login.uris.some(
      (u: any) => u.uri != null && u.uri.indexOf("http://") === 0,
    );
    return containsUnsecured;
  }

  /**
   * If the user does not have readonly set or it's false they have the ability to edit
   * @param cipher Current cipher with unsecured uri
   * @param allCollections The collections for the user
   */
  private canView(cipher: CipherView, allCollections: Collection[]): boolean {
    if (!cipher.organizationId) {
      return true;
    }

    return (
      allCollections.filter(
        (item) => cipher.collectionIds.indexOf(item.id) > -1 && !(item.readOnly ?? false),
      ).length > 0
    );
  }
}

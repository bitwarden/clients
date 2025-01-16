import { Component } from "@angular/core";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { ShareComponent as BaseShareComponent } from "@bitwarden/angular/components/share.component";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

@Component({
  selector: "app-vault-share",
  templateUrl: "share.component.html",
})
export class ShareComponent extends BaseShareComponent {
  constructor(
    cipherService: CipherService,
    i18nService: I18nService,
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    organizationService: OrganizationService,
    accountService: AccountService,
    private modalRef: ModalRef,
  ) {
    super(
      collectionService,
      platformUtilsService,
      i18nService,
      cipherService,
      logService,
      organizationService,
      accountService,
    );
  }

  protected close() {
    this.modalRef.close();
  }
}

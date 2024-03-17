import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { AttachmentsComponent as BaseAttachmentsComponent } from "@bitwarden/angular/vault/components/attachments.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-vault-attachments",
  templateUrl: "attachments.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class AttachmentsComponent extends BaseAttachmentsComponent {
  openedAttachmentsInPopup: boolean;

  constructor(
    cipherService: CipherService,
    i18nService: I18nService,
    cryptoService: CryptoService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    private location: Location,
    private route: ActivatedRoute,
    stateService: StateService,
    logService: LogService,
    fileDownloadService: FileDownloadService,
    dialogService: DialogService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    super(
      cipherService,
      i18nService,
      cryptoService,
      platformUtilsService,
      apiService,
      window,
      logService,
      stateService,
      fileDownloadService,
      dialogService,
      billingAccountProfileStateService,
    );
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      this.cipherId = params.cipherId;
      await this.init();
    });

    this.openedAttachmentsInPopup = history.length === 1;
  }

  back() {
    this.location.back();
  }

  close() {
    window.close();
  }
}

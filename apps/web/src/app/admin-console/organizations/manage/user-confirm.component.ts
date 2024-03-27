import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

@Component({
  selector: "app-user-confirm",
  templateUrl: "user-confirm.component.html",
})
export class UserConfirmComponent implements OnInit {
  @Input() name: string;
  @Input() userId: string;
  @Input() publicKey: Uint8Array;
  @Output() onConfirmedUser = new EventEmitter();

  dontAskAgain = false;
  loading = true;
  fingerprint: string;
  formPromise: Promise<any>;

  constructor(
    private cryptoService: CryptoService,
    private logService: LogService,
    private organizationManagementPreferencesService: OrganizationManagementPreferencesService,
  ) {}

  async ngOnInit() {
    try {
      if (this.publicKey != null) {
        const fingerprint = await this.cryptoService.getFingerprint(this.userId, this.publicKey);
        if (fingerprint != null) {
          this.fingerprint = fingerprint.join("-");
        }
      }
    } catch (e) {
      this.logService.error(e);
    }
    this.loading = false;
  }

  async submit() {
    if (this.loading) {
      return;
    }

    if (this.dontAskAgain) {
      await this.organizationManagementPreferencesService.autoConfirmFingerPrints.set(true);
    }

    this.onConfirmedUser.emit();
  }
}

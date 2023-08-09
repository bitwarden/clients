import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

@Component({
  selector: "emergency-access-confirm",
  templateUrl: "emergency-access-confirm.component.html",
})
export class EmergencyAccessConfirmComponent implements OnInit {
  @Input() name: string;
  @Input() userId: string;
  @Input() emergencyAccessId: string;
  @Input() formPromise: Promise<any>;
  @Output() onConfirmed = new EventEmitter();

  dontAskAgain = false;
  loading = true;
  fingerprint: string;

  constructor(
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private stateService: StateService,
    private logService: LogService
  ) {}

  async ngOnInit() {
    try {
      const publicKeyResponse = await this.apiService.getUserPublicKey(this.userId);
      if (publicKeyResponse != null) {
        const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);
        const fingerprint = await this.cryptoService.getFingerprint(this.userId, publicKey);
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
      await this.stateService.setAutoConfirmFingerprints(true);
    }

    try {
      this.onConfirmed.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }
}

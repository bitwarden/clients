// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";

import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../shared.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-account-fingerprint",
  templateUrl: "account-fingerprint.component.html",
  imports: [SharedModule],
})
export class AccountFingerprintComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() fingerprintMaterial: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() publicKeyBuffer: Uint8Array;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() fingerprintLabel: string;

  protected fingerprint: string;

  constructor(private keyService: KeyService) {}

  async ngOnInit() {
    // TODO - In the future, remove this code and use the fingerprint pipe once merged
    const generatedFingerprint = await this.keyService.getFingerprint(
      this.fingerprintMaterial,
      this.publicKeyBuffer,
    );
    this.fingerprint = generatedFingerprint?.join("-") ?? null;
  }
}

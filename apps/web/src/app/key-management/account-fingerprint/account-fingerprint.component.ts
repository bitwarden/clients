import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from "@angular/core";

import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../shared/shared.module";

@Component({
  selector: "app-account-fingerprint",
  templateUrl: "account-fingerprint.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
})
export class AccountFingerprintComponent implements OnInit {
  readonly fingerprintMaterial = input.required<string>();
  readonly publicKeyBuffer = input.required<Uint8Array>();
  readonly fingerprintLabel = input.required<string>();

  protected readonly fingerprint = signal<string | undefined>(undefined);

  private readonly keyService = inject(KeyService);

  async ngOnInit() {
    // TODO - In the future, remove this code and use the fingerprint pipe once merged
    const generatedFingerprint = await this.keyService.getFingerprint(
      this.fingerprintMaterial(),
      this.publicKeyBuffer(),
    );
    this.fingerprint.set(generatedFingerprint.join("-"));
  }
}

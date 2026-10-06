import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from "@angular/core";

// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";

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

  private readonly legacyCompatKeyService = inject(LegacyCompatKeyService);

  async ngOnInit() {
    // TODO - In the future, remove this code and use the fingerprint pipe once merged
    const generatedFingerprint = await this.legacyCompatKeyService.getFingerprint(
      this.fingerprintMaterial(),
      this.publicKeyBuffer(),
    );
    this.fingerprint.set(generatedFingerprint.join("-"));
  }
}

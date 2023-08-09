import { Pipe } from "@angular/core";

import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

@Pipe({
  name: "fingerprint",
})
export class FingerprintPipe {
  constructor(private cryptoService: CryptoService) {}

  async transform(publicKey: string | Uint8Array, fingerprintMaterial: string): Promise<string> {
    try {
      if (typeof publicKey === "string") {
        publicKey = Utils.fromB64ToArray(publicKey);
      }

      const fingerprint = await this.cryptoService.getFingerprint(fingerprintMaterial, publicKey);

      if (fingerprint != null) {
        return fingerprint.join("-");
      }

      return "";
    } catch {
      return "";
    }
  }
}

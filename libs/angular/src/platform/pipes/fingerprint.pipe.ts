import { Pipe } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { KeyService } from "@bitwarden/key-management";

@Pipe({
  name: "fingerprint",
  standalone: false,
})
export class FingerprintPipe {
  constructor(private keyService: KeyService) {}

  async transform(publicKey: string | Uint8Array, fingerprintMaterial: string): Promise<string> {
    try {
      if (typeof publicKey === "string") {
        publicKey = Utils.fromB64ToArray(publicKey);
      }

      const fingerprint = await this.keyService.getFingerprint(fingerprintMaterial, publicKey);

      if (fingerprint != null) {
        return fingerprint.join("-");
      }

      return "";
    } catch {
      return "";
    }
  }
}

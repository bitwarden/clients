import { Cipher as SdkCipher } from "@bitwarden/sdk-internal";

import { SdkRecordMapper } from "../../../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../../../platform/state";
import { ENCRYPTED_CIPHERS } from "../../services/key-state/ciphers.state";
import { CipherData } from "../data/cipher.data";

import { Cipher } from "./cipher";

export class CipherRecordMapper implements SdkRecordMapper<CipherData, SdkCipher> {
  userKeyDefinition(): UserKeyDefinition<Record<string, CipherData>> {
    return ENCRYPTED_CIPHERS;
  }

  toSdk(value: CipherData): SdkCipher {
    return new Cipher(value).toSdkCipher();
  }

  fromSdk(value: SdkCipher): CipherData {
    const cipher = Cipher.fromSdkCipher(value);
    return cipher!.toCipherData();
  }

  /**
   * Excludes PAM gated rows from the SDK-visible state. The SDK doesn't yet
   * have a partial-data decrypt path and rejects sparsely-populated ciphers
   * with a serde "invalid type: unit value" error, so we hide them entirely.
   * They still live in client state where the cipher service / vault badge
   * can see them.
   */
  shouldInclude(value: CipherData): boolean {
    return value.partialData == null;
  }
}

import { SdkRecordMapper } from "@bitwarden/common/platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { Cipher as SdkCipher } from "@bitwarden/sdk-internal";

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
}

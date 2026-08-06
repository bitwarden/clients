import { UserKeyState } from "@bitwarden/sdk-internal";

import { SymmetricCryptoKey } from "../platform/models/domain/symmetric-crypto-key";
import { SdkRecordMapper } from "../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../platform/state";
import { UserKey } from "../types/key";

import { USER_KEY } from "./state-definitions";

export class UserKeyRecordMapper implements SdkRecordMapper<UserKey, UserKeyState> {
  userKeyDefinition(): UserKeyDefinition<Record<string, UserKey>> {
    return USER_KEY;
  }

  toSdk(value: UserKey): UserKeyState {
    return { decrypted_user_key: value.toBase64() } as UserKeyState;
  }

  fromSdk(value: UserKeyState): UserKey {
    return SymmetricCryptoKey.fromString(value.decrypted_user_key) as UserKey;
  }
}

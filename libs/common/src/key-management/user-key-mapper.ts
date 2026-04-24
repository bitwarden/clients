import { SdkRecordMapper } from "@bitwarden/common/platform/services/sdk/client-managed-state";
import { USER_KEY } from "@bitwarden/common/platform/services/key-state/user-key.state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { UserKey } from "@bitwarden/common/types/key";
import { SymmetricKey } from "@bitwarden/sdk-internal";

import { SymmetricCryptoKey } from "../platform/models/domain/symmetric-crypto-key";

export class UserKeyRecordMapper implements SdkRecordMapper<UserKey, SymmetricKey> {
  userKeyDefinition(): UserKeyDefinition<Record<string, UserKey>> {
    return USER_KEY;
  }

  toSdk(value: UserKey): SymmetricKey {
    return (value as unknown as SymmetricCryptoKey).toSdk();
  }

  fromSdk(value: SymmetricKey): UserKey {
    return SymmetricCryptoKey.fromSdk(value) as UserKey;
  }
}

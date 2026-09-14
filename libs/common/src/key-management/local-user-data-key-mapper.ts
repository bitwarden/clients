// eslint-disable-next-line no-restricted-imports
import { LocalUserDataKey } from "@bitwarden/legacy-crypto";
import { LocalUserDataKeyState } from "@bitwarden/sdk-internal";

import { LOCAL_USER_DATA_KEY } from "../platform/services/key-state/local-user-data-key.state";
import { SdkRecordMapper } from "../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../platform/state";

export class LocalUserDataKeyRecordMapper implements SdkRecordMapper<
  LocalUserDataKey,
  LocalUserDataKeyState
> {
  userKeyDefinition(): UserKeyDefinition<Record<string, LocalUserDataKey>> {
    return LOCAL_USER_DATA_KEY;
  }

  toSdk(value: LocalUserDataKey): LocalUserDataKeyState {
    return { wrapped_key: value } as LocalUserDataKeyState;
  }

  fromSdk(value: LocalUserDataKeyState): LocalUserDataKey {
    return value.wrapped_key as LocalUserDataKey;
  }
}

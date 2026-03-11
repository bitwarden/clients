import { SdkRecordMapper } from "@bitwarden/common/platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { LocalUserDataKeyState } from "@bitwarden/sdk-internal";

import { LOCAL_USER_DATA_KEY } from "../platform/services/key-state/local-user-data-key.state";

import { LocalUserDataKey } from "./types";

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

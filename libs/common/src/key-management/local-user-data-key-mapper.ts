import { LocalUserDataKeyState } from "@bitwarden/sdk-internal";

import { LOCAL_USER_DATA_KEY } from "../platform/services/key-state/local-user-data-key.state";
import { SdkRecordMapper } from "../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../platform/state";

import { EncString } from "./crypto/models/enc-string";
import { LocalUserDataKey } from "./types";

export class LocalUserDataKeyRecordMapper implements SdkRecordMapper<
  LocalUserDataKey,
  LocalUserDataKeyState
> {
  userKeyDefinition(): UserKeyDefinition<Record<string, LocalUserDataKey>> {
    return LOCAL_USER_DATA_KEY;
  }

  toSdk(value: LocalUserDataKey): LocalUserDataKeyState {
    return { encrypted_key: value.toSdk() } as LocalUserDataKeyState;
  }

  fromSdk(value: LocalUserDataKeyState): LocalUserDataKey {
    return EncString.fromJSON(value.encrypted_key) as LocalUserDataKey;
  }
}

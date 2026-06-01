import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

export abstract class SharedUnlockSettingsService {
  abstract allowSharingUnlockState$(userId: UserId): Observable<boolean>;
  abstract setAllowSharingUnlockState(value: boolean, userId: UserId): Promise<void>;
  abstract allowSharingUnlockState(userId: UserId): Promise<boolean>;
}

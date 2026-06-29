import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

export abstract class SharedUnlockSettingsService {
  abstract allowSharingUnlockStateWithDesktop$(userId: UserId): Observable<boolean>;
  abstract allowSharingUnlockStateWithDesktop(userId: UserId): Promise<boolean>;
  abstract setAllowSharingUnlockStateWithDesktop(value: boolean, userId: UserId): Promise<void>;

  abstract allowSharingUnlockStateWithWeb$(userId: UserId): Observable<boolean>;
  abstract allowSharingUnlockStateWithWeb(userId: UserId): Promise<boolean>;
  abstract setAllowSharingUnlockStateWithWeb(value: boolean, userId: UserId): Promise<void>;
}

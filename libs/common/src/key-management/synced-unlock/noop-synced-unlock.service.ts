import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

import { SyncedUnlockService } from "./abstractions/synced-unlock.service";

export class NoopSyncedUnlockService extends SyncedUnlockService {
  isConnected(): Promise<boolean> {
    return Promise.resolve(false);
  }

  lock(userId: UserId): Promise<void> {
    return Promise.resolve();
  }

  getUserStatusFromDesktop(userId: UserId): Promise<AuthenticationStatus> {
    return Promise.resolve(AuthenticationStatus.LoggedOut);
  }

  getUserKeyFromDesktop(userId: UserId): Promise<UserKey | null> {
    return Promise.resolve(null);
  }

  focusDesktopApp(): Promise<void> {
    return Promise.resolve();
  }

  isConnectionTrusted(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";

export abstract class SyncedUnlockService {
  abstract isConnected(): Promise<boolean>;
  abstract lock(userId: UserId): Promise<void>;
  abstract getUserStatusFromDesktop(userId: UserId): Promise<AuthenticationStatus>;
  abstract getUserKeyFromDesktop(userId: UserId): Promise<UserKey | null>;
  abstract focusDesktopApp(): Promise<void>;
  abstract isConnectionTrusted(): Promise<boolean>;
}

import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

export abstract class SharedUnlockSettingsService {
  abstract allowSharingUnlockStateWithDesktop$(userId: UserId): Observable<boolean>;
  abstract setAllowSharingUnlockStateWithDesktop(value: boolean, userId: UserId): Promise<void>;

  abstract allowSharingUnlockStateWithWeb$(userId: UserId): Observable<boolean>;
  abstract setAllowSharingUnlockStateWithWeb(value: boolean, userId: UserId): Promise<void>;

  /**
   * Whether shared unlock is disabled for the user on the current device. Set when the user proceeds
   * through the login-decryption-options screen without trusting the device: a trusted-device
   * encryption (TDE) device the user declined to trust must not participate in shared unlock, since
   * receiving/sharing the User Key would bypass the device-trust requirement. Cleared on logout, so a
   * subsequent login can re-establish trust.
   */
  abstract unlockSharingDisabled$(userId: UserId): Observable<boolean>;
  abstract setUnlockSharingDisabled(userId: UserId, value: boolean): Promise<void>;
}

import { map, Observable } from "rxjs";

import type { PamNotificationSnapshot } from "@bitwarden/bit-pam";
import { UserId } from "@bitwarden/common/types/guid";
import {
  KeyDefinition,
  PAM_NOTIFICATIONS_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";

/** Global, not per user: the setting follows the person using the app, not one account. */
export const PAM_NOTIFICATIONS_ENABLED = new KeyDefinition<boolean>(
  PAM_NOTIFICATIONS_DISK,
  "enabled",
  { deserializer: (value) => value },
);

/** Ids and statuses only, so it holds no item, folder or person. Cleared on logout. */
export const PAM_NOTIFICATION_SNAPSHOT = new UserKeyDefinition<PamNotificationSnapshot>(
  PAM_NOTIFICATIONS_DISK,
  "snapshot",
  { deserializer: (value) => value, clearOn: ["logout"] },
);

export class PamNotificationStateService {
  /** On until the user turns it off. */
  readonly enabled$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    this.enabled$ = this.stateProvider
      .getGlobal(PAM_NOTIFICATIONS_ENABLED)
      .state$.pipe(map((enabled) => enabled ?? true));
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.stateProvider.getGlobal(PAM_NOTIFICATIONS_ENABLED).update(() => enabled);
  }

  snapshot$(userId: UserId): Observable<PamNotificationSnapshot | null> {
    return this.stateProvider.getUserState$(PAM_NOTIFICATION_SNAPSHOT, userId);
  }

  async setSnapshot(userId: UserId, snapshot: PamNotificationSnapshot): Promise<void> {
    await this.stateProvider.setUserState(PAM_NOTIFICATION_SNAPSHOT, snapshot, userId);
  }
}

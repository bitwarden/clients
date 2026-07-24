import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { UserKey } from "../../types/key";

/**
 * Holds the decrypted user key for each user. The presence of a user key in this
 * service is what defines a user's vault as unlocked in the current context.
 *
 * Implementations are per-process: contexts that do not own the authoritative copy
 * (e.g. browser popup, desktop renderer) proxy to the owning process over IPC.
 */
export abstract class UserKeyStateService {
  /**
   * Sets the user key for a user, or clears it when key is null.
   * Resolves only once the key is observable via getUserKey/userKey$ in this context.
   */
  abstract setUserKey(userId: UserId, key: UserKey | null): Promise<void>;

  /**
   * Retrieves the user key for a user, or null when the user has no key set (locked).
   */
  abstract getUserKey(userId: UserId): Promise<UserKey | null>;

  /**
   * Emits the user key for a user, and null while the user has no key set (locked).
   */
  abstract userKey$(userId: UserId): Observable<UserKey | null>;
}

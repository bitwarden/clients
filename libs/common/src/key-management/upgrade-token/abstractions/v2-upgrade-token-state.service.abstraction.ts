import { Observable } from "rxjs";

import { V2UpgradeToken } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";

export abstract class V2UpgradeTokenStateService {
  /**
   * Emits the V2 upgrade token for the given user, or `null` if none is stored.
   * @param userId The user ID.
   * @throws If the user ID is null or undefined.
   */
  abstract v2UpgradeToken$(userId: UserId): Observable<V2UpgradeToken | null>;

  /**
   * Stores the V2 upgrade token for the given user, replacing any existing value.
   * @param token The V2 upgrade token to persist.
   * @param userId The user ID.
   * @throws If the token or user ID is null or undefined.
   */
  abstract setV2UpgradeToken(token: V2UpgradeToken, userId: UserId): Promise<void>;

  /**
   * Clears the V2 upgrade token for the given user.
   * @param userId The user ID.
   * @throws If the user ID is null or undefined.
   */
  abstract clearV2UpgradeToken(userId: UserId): Promise<void>;
}

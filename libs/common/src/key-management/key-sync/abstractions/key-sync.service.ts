import { UserId } from "../../../types/guid";

export abstract class KeySyncService {
  /**
   * Reads the user's keys and unlock methods from the Key Service and writes them to state.
   * @param userId The user whose keys to sync. Their access token must already be set.
   * @throws When the Key Service can't be read or returns inconsistent keys. Nothing is written then.
   */
  abstract syncKeys(userId: UserId): Promise<void>;
}

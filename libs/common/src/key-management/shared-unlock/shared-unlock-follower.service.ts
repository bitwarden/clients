import { Observable } from "rxjs";

import { UnlockSource } from "@bitwarden/unlock";

import { UserId } from "../../types/guid";

export abstract class SharedUnlockFollowerService {
  abstract start(): Promise<void>;
  abstract externalUnlock$: Observable<UserId>;
  /**
   * Reports an unlock that happened in another client context, such as the browser extension popup,
   * which has its own {@link UnlockService} instance and therefore cannot notify this service
   * directly.
   *
   * @param userId The user that was unlocked
   * @param source Where the unlock originated from
   */
  abstract notifyUnlock(userId: UserId, source: UnlockSource): Promise<void>;
}

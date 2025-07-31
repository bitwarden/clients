import { Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

export abstract class ActiveUserAccessor {
  /**
   * Returns a stream of the current active user for the application. The stream either emits the user id for that account
   * or returns null if there is no current active user.
   */
  abstract activeUserId$: Observable<UserId | null>;
}

import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";

export abstract class EarlyAccessService {
  /**
   * Per-user Early Access preference. Gates on the `EarlyAccess` feature flag so this returns
   * false whenever the flag is disabled server-side, regardless of what is stored — the user's
   * opt-in is only honored while the feature flag is on.
   *
   * When enabled, the client sends the `Is-Prerelease` header on API requests for this user so
   * that feature flags evaluate with prerelease context. The stored preference persists across
   * logout for the account.
   */
  abstract earlyAccess$(userId: UserId): Observable<boolean>;

  /**
   * Sets the Early Access preference for the given user. Takes effect on subsequent API
   * requests; the user's cached server config is invalidated immediately so feature flags
   * re-evaluate on the next read rather than waiting for the natural refresh interval.
   */
  abstract setEarlyAccess(userId: UserId, enabled: boolean): Promise<void>;
}

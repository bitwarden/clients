import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { SecurityState } from "../models/security-state";

export abstract class SecurityStateService {
  /**
   * Retrieves the security state for the provided user.
   * Note: This state is not yet validated. To get a validated state, the SDK crypto client
   * must be used. This security state is validated on initialization of the SDK.
   */
  abstract accountSecurityState$(userId: UserId): Observable<SecurityState | null>;
  /**
   * Sets the security state for the provided user.
   */
  abstract setAccountSecurityState(
    accountSecurityState: SecurityState,
    userId: UserId,
  ): Promise<void>;
}

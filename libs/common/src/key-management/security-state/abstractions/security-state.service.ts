import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { SignedSecurityState } from "../../types";

export abstract class SecurityStateService {
  /**
   * Retrieves the security state for the provided user.
   * Note: This state is not yet validated. To get a validated state, the SDK crypto client
   * must be used. This security state is validated on initialization of the SDK.
   */
  abstract accountSecurityState$(userId: UserId): Observable<SignedSecurityState | null>;
  /**
   * Sets the security state for the provided user.
   */
  abstract setAccountSecurityState(
    accountSecurityState: SignedSecurityState,
    userId: UserId,
  ): Promise<void>;
}

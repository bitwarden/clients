import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { UserId } from "@bitwarden/user-core";

import { AutoConfirmState } from "../models/auto-confirm-state.model";

export abstract class AutomaticUserConfirmationService {
  /**
   * @param userId
   * @returns Observable<AutoConfirmState> an observable with the Auto Confirm user state for the provided userId.
   **/
  abstract configuration$(userId: UserId): Observable<AutoConfirmState>;
  /**
   * Upserts the existing user state with a new configuration.
   * @param userId
   * @param config The new AutoConfirmState to upsert into the user state for the provided userId.
   **/
  abstract upsert(userId: UserId, config: AutoConfirmState): Promise<void>;
  /**
   * This will check if the feature is enabled, the organization plan feature UseAutomaticUserConfirmation is enabled
   * and the the provided user has admin/owner/manage custom permission role.
   * @param userId
   * @returns Observable<boolean> an observable with a boolean telling us if the provided user may confgure the auto confirm feature.
   **/
  abstract canManageAutoConfirm$(userId: UserId): Observable<boolean>;
  /**
   * Calls the API endpoint to initiate automatic user confirmation.
   * @param userId The userId of the logged in admin performing auto confirmation. This is neccesary to perform the key exchange and for permissions checks.
   * @param confirmedUserId The userId of the member being confirmed.
   * @param organization the organization the member is being auto confirmed to.
   **/
  abstract autoConfirmUser(
    userId: UserId,
    confirmedUserId: UserId,
    organization: OrganizationId,
  ): Promise<void>;
}

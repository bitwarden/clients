import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { UserId } from "@bitwarden/user-core";

import { Organization } from "../../models/domain/organization";
import { AutoConfirmState } from "../../services/auto-confirm/auto-confirm.state";

export abstract class AutomaticUserConfirmationService {
  /**
   * @param userId
   * @returns Observable<Record<string, AutoConfirmState>>
   * Returns an observable with the Auto Confirm user state for the provided userId
   **/
  abstract configuration$(userId: UserId): Observable<AutoConfirmState>;
  /**
   * @param userId
   * @param config the new AutoConfirmState to upsert into the user state for the provided userId
   * Upserts the existing user state with a new configuration
   **/
  abstract upsert(userId: UserId, config: AutoConfirmState): Promise<void>;
  /**
   * @param userId
   * Returns an observable with a boolean telling us if the provided user may confgure the auto confirm feature.
   * This will check if the feature is enabled, the organization plan feature UseAutomaticUserConfirmation is enabled
   * and the the provided user has admin/owner/manage custom permission role.
   **/
  abstract canManageAutoConfirm$(
    userId: UserId,
    organizationId: OrganizationId,
  ): Observable<boolean>;
  /**
   * @param userId
   * @param organizationid
   * Calls the API endpoint to initiate automatic user confirmation
   **/
  abstract autoConfirmUser(userId: UserId, organization: Organization): Promise<void>;
}

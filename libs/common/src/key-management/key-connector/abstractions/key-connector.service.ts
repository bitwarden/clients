import { Observable } from "rxjs";

import { Organization } from "../../../admin-console/models/domain/organization";
import { OrganizationId, UserId } from "../../../types/guid";
import { KeyConnectorDomainConfirmation } from "../models/key-connector-domain-confirmation";
import { NewSsoUserKeyConnectorConversion } from "../models/new-sso-user-key-connector-conversion";

export abstract class KeyConnectorService {
  abstract getManagingOrganization(userId: UserId): Promise<Organization>;

  abstract getUsesKeyConnector(userId: UserId): Promise<boolean>;

  abstract migrateUser(keyConnectorUrl: string, userId: UserId): Promise<void>;

  /**
   * Sets up Key Connector decryption for a new SSO JIT provisioned user, and unlocks the user.
   *
   * @param userId The user to set up.
   * @param orgId The organization that provisions the user. The SSO JIT provision finish service
   *   matches it to a stored open invite.
   * @returns Whether we told the server to accept the organization invite.
   *   `SsoJitProvisionFinishService.shouldAcceptOrganizationInvite` makes this decision. The
   *   value is `false` only when `pm-34429-invite-link-auto-confirm` is on and the stored open
   *   invite is for this organization.
   */
  abstract convertNewSsoUserToKeyConnector(userId: UserId, orgId: OrganizationId): Promise<boolean>;

  abstract setUsesKeyConnector(enabled: boolean, userId: UserId): Promise<void>;

  abstract setNewSsoUserKeyConnectorConversionData(
    conversion: NewSsoUserKeyConnectorConversion,
    userId: UserId,
  ): Promise<void>;

  abstract requiresDomainConfirmation$(
    userId: UserId,
  ): Observable<KeyConnectorDomainConfirmation | null>;

  abstract convertAccountRequired$: Observable<boolean>;
}

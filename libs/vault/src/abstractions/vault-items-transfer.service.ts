import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationId, CollectionId } from "@bitwarden/common/types/guid";
import { UserId } from "@bitwarden/user-core";

export type UserMigrationInfo =
  | {
      /**
       * Whether the user requires migration of their vault items from My Vault to a My Items collection due to an
       * organizational policy change. (Enforce organization data ownership policy enabled)
       */
      requiresMigration: false;
    }
  | {
      /**
       * Whether the user requires migration of their vault items from My Vault to a My Items collection due to an
       * organizational policy change. (Enforce organization data ownership policy enabled)
       */
      requiresMigration: true;

      /**
       * The organization that is enforcing data ownership policies for the given user.
       */
      enforcingOrganization: Organization;

      /**
       * The default collection ID for the user in the enforcing organization, if available.
       */
      defaultCollectionId?: CollectionId;
    };

export abstract class VaultItemsTransferService {
  /**
   * Indicates whether a vault items transfer is currently in progress.
   */
  abstract transferInProgress$: Observable<boolean>;

  /**
   * Gets information about whether the given user requires migration of their vault items
   * from My Vault to a My Items collection, and whether they are capable of performing that migration.
   * @param userId
   */
  abstract userMigrationInfo$(userId: UserId): Observable<UserMigrationInfo>;

  /**
   * Enforces organization data ownership for the given user by transferring vault items.
   * Checks if any organization policies require the transfer, and if so, prompts the user to confirm before proceeding.
   *
   * Rejecting the transfer will result in the user being revoked from the organization.
   *
   * @param userId
   */
  abstract enforceOrganizationDataOwnership(userId: UserId): Promise<void>;

  /**
   * Begins transfer of vault items from My Vault to the specified default collection for the given user.
   */
  abstract transferPersonalItems(
    userId: UserId,
    organizationId: OrganizationId,
    defaultCollectionId: CollectionId,
  ): Promise<void>;
}

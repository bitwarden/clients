import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { UserId } from "@bitwarden/user-core";

export abstract class OrganizationInviteService {
  /**
   * Returns the currently stored organization invite
   */
  abstract getOrganizationInvite(): Promise<OrganizationInvite | null>;

  /**
   * Stores a new organization invite
   * @param invite an organization invite
   * @throws if the invite is nullish
   */
  abstract setOrganizationInvitation(invite: OrganizationInvite): Promise<void>;

  /**
   * Clears the currently stored organization invite
   */
  abstract clearOrganizationInvitation(): Promise<void>;

  /**
   * Accepts the invite for the active user, or stashes it and logs out if the user must
   * first satisfy the org's master-password policy. The stashed invite is consumed when
   * the user returns after re-authenticating with a compliant master password.
   * @returns true if the invite was accepted; false if it was stashed pending re-auth.
   * @throws if `invite` is nullish.
   */
  abstract validateAndAcceptInvite(
    invite: OrganizationInvite,
    activeUserId: UserId,
  ): Promise<boolean>;

  /**
   * Fetches all enabled policies for the inviting organization, authenticated via the invite token
   * (no user session required). Callers filter by `PolicyType` for their needs (e.g. `MasterPassword`,
   * `ResetPassword`). Results are cached on the service instance keyed by invite token; the cache
   * is cleared on `setOrganizationInvitation` and `clearOrganizationInvitation` so state transitions
   * never leave stale entries behind.
   * @returns all enabled policies for the org, or null on fetch error.
   */
  abstract getInvitePolicies(invite: OrganizationInvite): Promise<Policy[] | null>;
}

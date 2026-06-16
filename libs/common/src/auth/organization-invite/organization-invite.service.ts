import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { UserId } from "@bitwarden/user-core";

/**
 * Owns the in-flight organization invite: persisted across login/register/MP-policy
 * detours, then consumed when the user accepts (or stashed and reloaded if an MP
 * policy check redirects them through re-auth first).
 */
export abstract class OrganizationInviteService {
  /**
   * Returns the currently stored organization invite
   */
  abstract getOrganizationInvite(): Promise<OrganizationInvite | null>;

  /**
   * Stores a new organization invite. Pass a non-null OrganizationInvite; callers that
   * want to remove the stored invite should use {@link clearOrganizationInvite}.
   */
  abstract setOrganizationInvite(invite: OrganizationInvite): Promise<void>;

  /**
   * Clears the currently stored organization invite
   */
  abstract clearOrganizationInvite(): Promise<void>;

  /**
   * Accepts the invite for the active user, or stashes it and logs out if the user must
   * first satisfy the org's master-password policy. The stashed invite is consumed when
   * the user returns after re-authenticating with a compliant master password.
   * @returns true if the invite was accepted; false if it was stashed pending re-auth.
   */
  abstract validateAndAcceptInvite(invite: OrganizationInvite, userId: UserId): Promise<boolean>;

  /**
   * Fetches all enabled policies for the inviting organization, authenticated via the invite token
   * (no user session required). Callers filter by `PolicyType` for their needs (e.g. `MasterPassword`,
   * `ResetPassword`). Results are cached on the service instance keyed by invite token; the cache
   * is cleared on `setOrganizationInvite` and `clearOrganizationInvite` so state transitions
   * never leave stale entries behind.
   * @returns all enabled policies for the org, or undefined on fetch error.
   */
  abstract getInvitePolicies(invite: OrganizationInvite): Promise<Policy[] | undefined>;
}

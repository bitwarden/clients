import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";

export abstract class OrganizationInviteService {
  /**
   * Returns the currently stored organization invite
   */
  abstract getOrganizationInvite: () => Promise<OrganizationInvite | null>;

  /**
   * Stores a new organization invite
   * @param invite an organization invite
   * @throws if the invite is nullish
   */
  abstract setOrganizationInvitation: (invite: OrganizationInvite) => Promise<void>;

  /**
   * Clears the currently stored organization invite
   */
  abstract clearOrganizationInvitation: () => Promise<void>;
}

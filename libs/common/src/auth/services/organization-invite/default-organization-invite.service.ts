import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";

export class DefaultOrganizationInviteService implements OrganizationInviteService {
  /**
   * No-op implementation.
   */
  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return null;
  }

  /**
   * No-op implementation.
   * @param invite an organization invite
   */
  async setOrganizationInvitation(invite: OrganizationInvite): Promise<void> {
    return;
  }

  /**
   * No-op implementation.
   * */
  async clearOrganizationInvitation(): Promise<void> {
    return;
  }
}

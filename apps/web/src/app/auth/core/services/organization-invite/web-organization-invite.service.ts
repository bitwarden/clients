import { firstValueFrom } from "rxjs";

import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";
import { ORGANIZATION_INVITE } from "@bitwarden/common/auth/services/organization-invite/organization-invite-state";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { GlobalState, GlobalStateProvider } from "@bitwarden/common/platform/state";

export class WebOrganizationInviteService implements OrganizationInviteService {
  private organizationInvitationState: GlobalState<OrganizationInvite | null>;

  constructor(private readonly globalStateProvider: GlobalStateProvider) {
    this.organizationInvitationState = this.globalStateProvider.get(ORGANIZATION_INVITE);
  }

  /**
   * Returns the currently stored organization invite
   */
  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return await firstValueFrom(this.organizationInvitationState.state$);
  }

  /**
   * Stores a new organization invite
   * @param invite an organization invite
   * @throws if the invite is nullish
   */
  async setOrganizationInvitation(invite: OrganizationInvite): Promise<void> {
    if (invite == null) {
      throw new Error("Invite cannot be null. Use clearOrganizationInvitation instead.");
    }
    await this.organizationInvitationState.update(() => invite);
  }

  /** Clears the currently stored organization invite */
  async clearOrganizationInvitation(): Promise<void> {
    await this.organizationInvitationState.update(() => null);
  }
}

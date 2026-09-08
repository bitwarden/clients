import { Observable } from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { OrganizationInviteLinkView } from "../models/organization-invite-link.view";

export abstract class OrganizationInviteLinkService {
  /** Observable stream of the cached invite link for the given user */
  abstract inviteLink$(
    userId: UserId,
    orgId: OrganizationId,
  ): Observable<OrganizationInviteLinkView | undefined>;

  /**
   * Create a new invite link for the organization. Resolves once the SDK key generation,
   * API call, and local state update have all succeeded.
   */
  abstract createInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
    supportsConfirmation: boolean,
  ): Promise<void>;

  /**
   * Update the allowed domains on an existing invite link.
   */
  abstract updateAllowedDomains(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomain: string[],
  ): Promise<void>;

  /**
   * Refresh the invite link via the server endpoint. Resolves once the SDK key generation,
   * API call, and local state update have all succeeded.
   */
  abstract refreshInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void>;

  /** Persist an invite link to local state */
  abstract upsert(userId: UserId, data: OrganizationInviteLinkView): Promise<void>;

  /** Delete (revoke) the invite link via the SDK and clear local cached state */
  abstract delete(userId: UserId, orgId: OrganizationId): Promise<void>;
}

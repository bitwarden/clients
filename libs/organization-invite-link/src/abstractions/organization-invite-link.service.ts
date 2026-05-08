import { Observable } from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { OrganizationInviteLink } from "../models/responses/organization-invite-link.response";

export abstract class OrganizationInviteLinkService {
  /** Observable stream of the cached invite link for the given user */
  abstract inviteLink$(
    userId: UserId,
    orgId: OrganizationId,
  ): Observable<OrganizationInviteLink | undefined>;

  /**
   * Create a new invite link for the organization.
   */
  abstract createInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomains: string[],
  ): Promise<void>;

  /**
   * Update the allowed domains on an existing invite link.
   */
  abstract updateInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    allowedDomain: string[],
  ): Promise<void>;

  /**
   * Refresh the invite link via the server endpoint.
   * Emits the shareable URL once, then completes.
   */
  abstract refreshInviteLink(userId: UserId, orgId: OrganizationId): Promise<void>;

  /**
   * Reconstruct and returns the shareable URL from OrganizationInviteLink in local state as a string
   */
  abstract reconstructUrl(userId: UserId, orgId: OrganizationId): Promise<string>;

  /** Persist an invite link to local state */
  abstract upsert(userId: UserId, data: OrganizationInviteLink): Promise<void>;

  /** Delete (revoke) the invite link via the API and clear local cached state */
  abstract delete(userId: UserId, orgId: OrganizationId): Promise<void>;
}

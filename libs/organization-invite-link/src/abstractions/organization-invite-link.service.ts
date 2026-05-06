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
    domains: string[],
  ): Promise<void>;

  /**
   * Update the allowed domains on an existing invite link.
   */
  abstract updateInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    domains: string[],
  ): Promise<void>;

  /**
   * Updates the Organization invite link without modifying allowed domains (generates a new link)
   */
  abstract refreshInviteLink(userId: UserId, orgId: OrganizationId): Promise<void>;

  /**
   * Reconstruct and returns an Observable containing the shareable URL from provided OrganizationInviteLink
   */
  abstract reconstructUrl(inviteLink: OrganizationInviteLink, userId: UserId): Observable<string>;

  /** Persist an invite link to local state */
  abstract upsert(userId: UserId, data: OrganizationInviteLink): Promise<void>;

  /** Delete (revoke) the invite link via the API and clear local cached state */
  abstract delete(userId: UserId, orgId: OrganizationId): Promise<void>;
}

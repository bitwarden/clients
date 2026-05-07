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
   * Reconstruct and returns a Promise containing the shareable URL for the organization's invite link.
   * Fetches the invite link from state (or API if not cached).
   */
  abstract reconstructUrl(userId: UserId, orgId: OrganizationId): Promise<string>;

  /** Persist an invite link to local state */
  abstract upsert(userId: UserId, data: OrganizationInviteLink): Promise<void>;

  /** Delete (revoke) the invite link via the API and clear local cached state */
  abstract delete(userId: UserId, orgId: OrganizationId): Promise<void>;
}

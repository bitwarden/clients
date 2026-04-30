import { Observable } from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { OrganizationInviteLinkResponseModel } from "../models/responses/organization-invite-link.response";

export abstract class OrganizationInviteLinkService {
  /** Observable stream of the cached invite link for the given user */
  abstract inviteLink$(userId: UserId): Observable<OrganizationInviteLinkResponseModel | undefined>;

  /**
   * Create a new invite link for the organization.
   * Emits the shareable URL once, then completes.
   */
  abstract createInviteLink(
    userId: UserId,
    orgId: OrganizationId,
    domains: string[],
  ): Promise<string>;

  /**
   * Refresh the invite link using cached allowed domains.
   * Emits the shareable URL once, then completes.
   */
  abstract refreshInviteLink(userId: UserId, orgId: OrganizationId): Promise<string>;

  /**
   * Reconstruct the shareable URL from the server-stored invite link.
   * Emits the URL (or undefined when none exists), then completes.
   */
  abstract reconstructUrl(userId: UserId, orgId: OrganizationId): Promise<string | undefined>;

  /** Persist an invite link response to local state */
  abstract upsert(userId: UserId, data: OrganizationInviteLinkResponseModel): Promise<void>;

  /** Delete (revoke) the invite link via the API and clear local cached state */
  abstract delete(userId: UserId, orgId: OrganizationId): Promise<void>;

  /** Clear local cached invite link state for the user without calling the API */
  abstract clear(userId: UserId): Promise<void>;
}

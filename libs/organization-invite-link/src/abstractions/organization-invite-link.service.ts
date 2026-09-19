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
  abstract create(
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
   * Change whether the existing invite link supports confirmation, i.e. whether invitees
   * self-confirm (`true`) or an admin must confirm them out of band (`false`).
   *
   * Only the confirmation setting changes — the link's code and secret are preserved, so
   * already-distributed links keep working. Rejects when the organization has no invite link.
   */
  abstract setInviteConfirmation(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void>;

  /**
   * Refresh the invite link via the server endpoint. Resolves once the SDK key generation,
   * API call, and local state update have all succeeded.
   */
  abstract refresh(
    userId: UserId,
    orgId: OrganizationId,
    supportsConfirmation: boolean,
  ): Promise<void>;

  /** Delete (revoke) the invite link via the SDK and clear local cached state */
  abstract delete(userId: UserId, orgId: OrganizationId): Promise<void>;
}

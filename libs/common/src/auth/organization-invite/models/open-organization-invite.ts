import { Jsonify } from "type-fest";

import { OrgInviteKind } from "../enums/org-invite-kind.enum";
import { OpenOrgInviteSsoConfig, OpenOrgInviteStatus } from "../types/open-org-invite-status.type";

/**
 * URL contract for the open invite link route: `/#/join/:inviteLinkCode?key={inviteKey}`.
 * `inviteLinkCode` is a server-generated GUID; `inviteKey` is the URL-fragment key,
 * which the browser never transmits to the server in HTTP requests.
 */
// TODO: PM-40216 (PR #21815) — invite URL adds an `organizationId` path segment.
// When that PR lands, add `organizationId: string` here (also to the constructor,
// fromUrlParamsAndStatus, fromJSON, and the class field), update the route path in
// oss-routing.module.ts, and re-wire the downstream consumers currently stubbed
// with PM-40216 TODOs (computeOpenInviteResetPasswordKey; the openMatch branch in
// WebLoginComponentService).
export interface OpenOrgInviteUrlParams {
  inviteLinkCode: string;
  inviteKey: string;
}

/**
 * Domain object representing one open organization invite (admin published a reusable
 * link that anyone holding the URL can use to join; the link carries no user identity).
 * Hydrated from URL params + the status fetch ({@link fromUrlParamsAndStatus}) or from
 * persisted state ({@link fromJSON}). Required fields are enforced by the constructor.
 *
 * Discriminates against {@link DirectOrganizationInvite} via {@link kind}.
 */
export class OpenOrganizationInvite {
  readonly kind = OrgInviteKind.Open;
  inviteLinkCode: string;
  inviteKey: string;
  organizationName: string;
  /** Absent when the org has no SSO configured/enabled. */
  sso?: OpenOrgInviteSsoConfig;

  constructor(data: {
    inviteLinkCode: string;
    inviteKey: string;
    organizationName: string;
    sso?: OpenOrgInviteSsoConfig;
  }) {
    this.inviteLinkCode = data.inviteLinkCode;
    this.inviteKey = data.inviteKey;
    this.organizationName = data.organizationName;
    this.sso = data.sso;
  }

  /**
   * Factory: takes validated URL params + the status snapshot and produces the
   * fully-formed invite.
   */
  static fromUrlParamsAndStatus(
    urlParams: OpenOrgInviteUrlParams,
    status: OpenOrgInviteStatus,
  ): OpenOrganizationInvite {
    return new OpenOrganizationInvite({
      inviteLinkCode: urlParams.inviteLinkCode,
      inviteKey: urlParams.inviteKey,
      organizationName: status.organizationName,
      sso: status.sso ?? undefined,
    });
  }

  /**
   * Hydrates from persisted state. Trusts its input — the only write path goes through
   * the typed constructor, which enforces required fields.
   */
  static fromJSON(json: Jsonify<OpenOrganizationInvite>): OpenOrganizationInvite | null {
    if (json == null) {
      return null;
    }
    return new OpenOrganizationInvite(json);
  }
}

import { Jsonify } from "type-fest";

import { OrgInviteKind } from "./org-invite-kind";

/**
 * URL contract for the open invite link route: `/#/join/:inviteLinkCode?key={inviteKey}`.
 * `inviteLinkCode` is a server-generated GUID; `inviteKey` is the URL-fragment key,
 * which the browser never transmits to the server in HTTP requests.
 */
export interface OpenOrgInviteUrlParams {
  inviteLinkCode: string;
  inviteKey: string;
}

/**
 * SSO configuration snapshot for an open invite link, captured at landing time from
 * the open-invite status endpoint. Persisted on {@link OpenOrganizationInvite} so
 * login/registration can decide SSO routing without re-calling status.
 *
 * Present only when the inviting org has SSO both configured and enabled.
 */
export interface OpenOrgInviteSsoConfig {
  orgSsoId: string;
  required: boolean;
}

/**
 * Response shape from the open-invite status endpoint
 * (`OrganizationInviteService.getOpenInviteStatus(code)`). The wrapper resolves with
 * this shape on 200; 400 (org plan doesn't support invite links) and 404 (link not
 * found / org deleted / org disabled) throw `ErrorResponse` for the caller to
 * discriminate.
 */
export interface OpenOrgInviteStatus {
  organizationName: string;
  seatsAvailable: boolean;
  sso: OpenOrgInviteSsoConfig | null;
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
   * Single happy-path factory: takes validated URL params + the status response and
   * produces the fully-formed invite. The "partial" lifecycle moment (URL params known,
   * status not yet fetched) is intentionally not modeled — there is no construction
   * path that produces a half-populated invite.
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

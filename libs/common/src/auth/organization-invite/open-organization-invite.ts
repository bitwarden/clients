import { Jsonify } from "type-fest";

import {
  OpenOrgInviteSsoConfig,
  OpenOrgInviteStatusResponse,
} from "./open-org-invite-status.response";
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
 * Domain object representing one open organization invite (admin published a reusable
 * link that anyone holding the URL can use to join; the link carries no user identity).
 * Hydrated from URL params + the status fetch ({@link fromUrlParamsAndStatusResponse}) or from
 * persisted state ({@link fromJSON}). Required fields are enforced by the constructor.
 *
 * Discriminates against {@link DirectOrganizationInvite} via {@link kind}.
 */
export class OpenOrganizationInvite {
  readonly kind = OrgInviteKind.Open;
  inviteLinkCode: string;
  inviteKey: string;
  organizationId: string;
  organizationName: string;
  /** Absent when the org has no SSO configured/enabled. */
  sso?: OpenOrgInviteSsoConfig;

  constructor(data: {
    inviteLinkCode: string;
    inviteKey: string;
    organizationId: string;
    organizationName: string;
    sso?: OpenOrgInviteSsoConfig;
  }) {
    this.inviteLinkCode = data.inviteLinkCode;
    this.inviteKey = data.inviteKey;
    this.organizationId = data.organizationId;
    this.organizationName = data.organizationName;
    this.sso = data.sso;
  }

  /**
   * Factory: takes validated URL params + the status response and produces the
   * fully-formed invite.
   */
  static fromUrlParamsAndStatusResponse(
    urlParams: OpenOrgInviteUrlParams,
    statusResponse: OpenOrgInviteStatusResponse,
  ): OpenOrganizationInvite {
    return new OpenOrganizationInvite({
      inviteLinkCode: urlParams.inviteLinkCode,
      inviteKey: urlParams.inviteKey,
      organizationId: statusResponse.organizationId,
      organizationName: statusResponse.organizationName,
      sso: statusResponse.sso ?? undefined,
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

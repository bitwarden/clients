import { Jsonify } from "type-fest";

import { OrgInviteKind } from "../enums/org-invite-kind.enum";
import { OpenOrgInviteSsoConfig, OpenOrgInviteStatus } from "../types/open-org-invite-status.type";

/**
 * The fields that represent an open organization invite.
 * Canonical carrier is the open org invite link URL, which is of the form
 * `/#/join/:organizationId/:inviteLinkCode?key={inviteKey}`; the same shape also crosses
 * the sealed-blob round-trip used by the registration-crossing flow.
 */
export interface OpenOrgInviteLinkData {
  /** Scopes the invite to a specific org */
  organizationId: string;
  /** Server-generated GUID. */
  inviteLinkCode: string;
  /** URL-fragment key; the browser never transmits it to the server in HTTP requests. */
  inviteKey: string;
}

/**
 * Domain object representing one open organization invite (admin published a reusable
 * link that anyone holding the URL can use to join; the link carries no user identity).
 * Hydrated from link data + the status fetch ({@link fromLinkDataAndStatus}) or from
 * persisted state ({@link fromJSON}). Required fields are enforced by the constructor.
 *
 * Discriminates against {@link DirectOrganizationInvite} via {@link kind}.
 */
export class OpenOrganizationInvite {
  readonly kind = OrgInviteKind.Open;
  organizationId: string;
  inviteLinkCode: string;
  inviteKey: string;
  organizationName: string;
  /** Absent when the org has no SSO configured/enabled. */
  sso?: OpenOrgInviteSsoConfig;

  constructor(data: {
    organizationId: string;
    inviteLinkCode: string;
    inviteKey: string;
    organizationName: string;
    sso?: OpenOrgInviteSsoConfig;
  }) {
    this.organizationId = data.organizationId;
    this.inviteLinkCode = data.inviteLinkCode;
    this.inviteKey = data.inviteKey;
    this.organizationName = data.organizationName;
    this.sso = data.sso;
  }

  /**
   * Factory: takes validated link data + the status snapshot and produces the
   * fully-formed invite.
   */
  static fromLinkDataAndStatus(
    linkData: OpenOrgInviteLinkData,
    status: OpenOrgInviteStatus,
  ): OpenOrganizationInvite {
    return new OpenOrganizationInvite({
      organizationId: linkData.organizationId,
      inviteLinkCode: linkData.inviteLinkCode,
      inviteKey: linkData.inviteKey,
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

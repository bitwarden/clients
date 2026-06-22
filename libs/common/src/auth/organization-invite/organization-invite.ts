import { Jsonify } from "type-fest";

import { isId } from "../../types/guid";

/**
 * Documents the URL query param contract emitted by the server for organization invite
 * acceptance links - specifically `OrganizationUserInvitedViewModel.Url` in the server
 * repo. All values are strings because they originate from a URL query string. Booleans
 * arrive stringified (`"true"` / `"false"`).
 *
 * `orgSsoIdentifier` is the only conditional param - the server only emits it when the
 * org has SSO enabled and the SSO login required policy is on.
 */
export interface OrganizationInviteUrlParams {
  organizationId: string;
  organizationUserId: string;
  email: string;
  organizationName: string;
  token: string;
  initOrganization: string;
  orgUserHasExistingUser: string;
  orgSsoIdentifier?: string;
}

/**
 * Domain object representing one organization invite. Hydrated either from the
 * server's emailed-link query string ({@link fromUrlParams}) or from persisted
 * state ({@link fromJSON}). Required fields are enforced by the constructor; both
 * factories return null when their input is missing or malformed.
 */
export class OrganizationInvite {
  email: string;
  initOrganization: boolean;
  orgSsoIdentifier?: string;
  orgUserHasExistingUser: boolean;
  organizationId: string;
  organizationName: string;
  organizationUserId: string;
  token: string;

  constructor(data: {
    email: string;
    initOrganization: boolean;
    orgSsoIdentifier?: string;
    orgUserHasExistingUser: boolean;
    organizationId: string;
    organizationName: string;
    organizationUserId: string;
    token: string;
  }) {
    this.email = data.email;
    this.initOrganization = data.initOrganization;
    this.orgSsoIdentifier = data.orgSsoIdentifier;
    this.orgUserHasExistingUser = data.orgUserHasExistingUser;
    this.organizationId = data.organizationId;
    this.organizationName = data.organizationName;
    this.organizationUserId = data.organizationUserId;
    this.token = data.token;
  }

  /**
   * Hydrates an OrganizationInvite from the URL query params emitted by the server's
   * accept-organization link. Returns null if any required param is missing or fails
   * validation - callers should treat null as an invalid/corrupted link.
   *
   * @see {@link OrganizationInviteUrlParams} for the server contract.
   */
  static fromUrlParams(params: Record<string, string | undefined>): OrganizationInvite | null {
    if (params == null) {
      return null;
    }
    if (
      !isId(params.organizationId) ||
      !isId(params.organizationUserId) ||
      params.email == null ||
      params.token == null ||
      params.organizationName == null ||
      params.initOrganization == null ||
      params.orgUserHasExistingUser == null
    ) {
      return null;
    }
    return new OrganizationInvite({
      email: params.email,
      organizationId: params.organizationId,
      organizationUserId: params.organizationUserId,
      organizationName: params.organizationName,
      token: params.token,
      initOrganization: params.initOrganization.toLowerCase() === "true",
      orgUserHasExistingUser: params.orgUserHasExistingUser.toLowerCase() === "true",
      orgSsoIdentifier: params.orgSsoIdentifier,
    });
  }

  /**
   * Hydrates from persisted state. Trusts its input - the only write path goes through
   * the typed constructor, which enforces required fields.
   */
  static fromJSON(json: Jsonify<OrganizationInvite>): OrganizationInvite | null {
    if (json == null) {
      return null;
    }
    return new OrganizationInvite(json);
  }
}

import { Jsonify } from "type-fest";

import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Invite } from "@bitwarden/sdk-internal";

export class OrganizationInviteLinkResponseModel extends BaseResponse {
  /** The unique identifier of the invite link. */
  id: string;
  /** The public code used to reference and access the invite link. */
  code: string;
  /** The identifier of the organization that owns the invite link. */
  organizationId: string;
  /** The email domains permitted to use the invite link. */
  allowedDomains: string[];
  /** The invite cryptographic material for the invite link. */
  invite: Invite;
  /** Whether this invite link can be used to confirm a user. */
  supportsConfirmation: boolean;
  /** The ISO-8601 date the invite link was created. */
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.code = this.getResponseProperty("Code");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.allowedDomains = this.getResponseProperty("AllowedDomains");
    this.invite = this.getResponseProperty("Invite") as Invite;
    this.supportsConfirmation = this.getResponseProperty("SupportsConfirmation");
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}

export class OrganizationInviteLink {
  /** The unique identifier of the invite link. */
  id: string;
  /** The public code used to reference and access the invite link. */
  code: string;
  /** The identifier of the organization that owns the invite link. */
  organizationId: string;
  /** The email domains permitted to use the invite link. */
  allowedDomains: string[];
  /** The invite cryptographic material for the invite link. */
  invite: Invite;
  /** Whether this invite link can be used to confirm a user. */
  supportsConfirmation: boolean;
  /** The ISO-8601 date the invite link was created. */
  creationDate: string;

  constructor(response: OrganizationInviteLinkResponseModel) {
    this.id = response.id;
    this.code = response.code;
    this.organizationId = response.organizationId;
    this.allowedDomains = response.allowedDomains;
    this.invite = response.invite;
    this.supportsConfirmation = response.supportsConfirmation;
    this.creationDate = response.creationDate;
  }

  static fromJSON(obj: Jsonify<OrganizationInviteLink>): OrganizationInviteLink {
    return Object.assign(new OrganizationInviteLink(obj as any), obj);
  }
}

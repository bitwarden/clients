import { Jsonify } from "type-fest";

import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Invite } from "@bitwarden/sdk-internal";

export class OrganizationInviteLinkResponseModel extends BaseResponse {
  id: string;
  code: string;
  organizationId: string;
  allowedDomains: string[];
  invite: Invite;
  supportsConfirmation: boolean;
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
  id: string;
  code: string;
  organizationId: string;
  allowedDomains: string[];
  invite: Invite;
  supportsConfirmation: boolean;
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

import { Jsonify } from "type-fest";

import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationInviteLinkResponseModel extends BaseResponse {
  id: string;
  code: string;
  organizationId: string;
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | undefined;
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.code = this.getResponseProperty("Code");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.allowedDomains = this.getResponseProperty("AllowedDomains");
    this.encryptedInviteKey = this.getResponseProperty("EncryptedInviteKey");
    this.encryptedOrgKey = this.getResponseProperty("EncryptedOrgKey");
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}

export class OrganizationInviteLink {
  id: string;
  code: string;
  organizationId: string;
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | undefined;
  creationDate: string;

  constructor(response: OrganizationInviteLinkResponseModel) {
    this.id = response.id;
    this.code = response.code;
    this.organizationId = response.organizationId;
    this.allowedDomains = response.allowedDomains;
    this.encryptedInviteKey = response.encryptedInviteKey;
    this.encryptedOrgKey = response.encryptedOrgKey;
    this.creationDate = response.creationDate;
  }

  static fromJSON(obj: Jsonify<OrganizationInviteLink>): OrganizationInviteLink {
    return Object.assign(new OrganizationInviteLink(obj as any), obj);
  }
}

import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationInviteLinkResponseModel extends BaseResponse {
  id: string;
  code: string;
  organizationId: string;
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | null;
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

import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationInviteLinkResponseModel extends BaseResponse {
  code: string;
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | null;
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.code = this.getResponseProperty("Code");
    this.allowedDomains = this.getResponseProperty("AllowedDomains");
    this.encryptedInviteKey = this.getResponseProperty("EncryptedInviteKey");
    this.encryptedOrgKey = this.getResponseProperty("EncryptedOrgKey");
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}

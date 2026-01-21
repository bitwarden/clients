import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationUserBulkPublicKeyResponse extends BaseResponse {
  id: string;
  userId: string;
  key: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.key = this.getResponseProperty("Key");
  }
}

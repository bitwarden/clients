import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationInviteLinkInviteBlobResponse extends BaseResponse {
  inviteBlob: string;

  constructor(response: any) {
    super(response);
    this.inviteBlob = this.getResponseProperty("InviteBlob");
  }
}

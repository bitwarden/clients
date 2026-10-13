import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationUserPendingAutoConfirmResponse extends BaseResponse {
  /** The OrganizationUser ID — used for the confirm call. */
  id: string;
  /** The User ID — used for public key lookup. */
  userId: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
  }
}

import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class AccessTokenResponse extends BaseResponse {
  id: string;
  name: string;
  scopes: string[];
  expireAt?: string;
  creationDate: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.scopes = this.getResponseProperty("Scopes");
    this.expireAt = this.getResponseProperty("ExpireAt");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

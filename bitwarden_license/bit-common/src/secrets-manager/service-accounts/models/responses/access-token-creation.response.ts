import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class AccessTokenCreationResponse extends BaseResponse {
  id: string;
  name: string;
  clientSecret: string;
  expireAt?: string;
  creationDate: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.clientSecret = this.getResponseProperty("ClientSecret");
    this.expireAt = this.getResponseProperty("ExpireAt");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

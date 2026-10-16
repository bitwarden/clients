import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class ServiceAccountCountsResponse extends BaseResponse {
  projects: number;
  people: number;
  accessTokens: number;

  constructor(response: any) {
    super(response);
    this.projects = this.getResponseProperty("Projects");
    this.people = this.getResponseProperty("People");
    this.accessTokens = this.getResponseProperty("AccessTokens");
  }
}

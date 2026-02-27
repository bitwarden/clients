import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class ProjectCountsResponse extends BaseResponse {
  people: number;
  secrets: number;
  serviceAccounts: number;

  constructor(response: any) {
    super(response);
    this.people = this.getResponseProperty("People");
    this.secrets = this.getResponseProperty("Secrets");
    this.serviceAccounts = this.getResponseProperty("ServiceAccounts");
  }
}

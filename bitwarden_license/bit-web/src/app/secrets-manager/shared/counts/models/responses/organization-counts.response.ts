import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationCountsResponse extends BaseResponse {
  projects: number;
  secrets: number;
  serviceAccounts: number;

  constructor(response: any) {
    super(response);
    this.projects = this.getResponseProperty("Projects");
    this.secrets = this.getResponseProperty("Secrets");
    this.serviceAccounts = this.getResponseProperty("ServiceAccounts");
  }
}

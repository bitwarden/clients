import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class SecretsManagerExportedProjectResponse extends BaseResponse {
  id: string;
  name: string;

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
  }
}

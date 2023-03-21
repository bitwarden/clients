import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class SecretsManagerExportedProjectResponse extends BaseResponse {
  id: Guid;
  name: string;

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty<Guid>("Id");
    this.name = this.getResponseProperty("Name");
  }
}

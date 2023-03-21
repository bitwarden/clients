import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class SecretProjectResponse extends BaseResponse {
  id: Guid;
  name: string;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.id = this.getResponseProperty("Id");
  }
}

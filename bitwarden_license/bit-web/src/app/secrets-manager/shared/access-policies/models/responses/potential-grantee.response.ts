import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class PotentialGranteeResponse extends BaseResponse {
  id: Guid;
  name: string;
  type: string;
  email: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.type = this.getResponseProperty("Type");
    this.email = this.getResponseProperty("Email");
  }
}

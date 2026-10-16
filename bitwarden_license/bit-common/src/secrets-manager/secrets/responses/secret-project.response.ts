import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class SecretProjectResponse extends BaseResponse {
  id: string;
  name: string;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.id = this.getResponseProperty("Id");
  }
}

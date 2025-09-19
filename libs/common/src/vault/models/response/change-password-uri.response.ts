import { BaseResponse } from "../../../models/response/base.response";

export class ChangePasswordUriResponse extends BaseResponse {
  uri: string | null;

  constructor(response: any) {
    super(response);
    this.uri = this.getResponseProperty("uri");
  }
}

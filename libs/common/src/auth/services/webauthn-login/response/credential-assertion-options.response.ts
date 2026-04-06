import { BaseResponse } from "../../../../models/response/base.response";

import { AssertionOptionsResponse } from "./assertion-options.response";

export class CredentialAssertionOptionsResponse extends BaseResponse {
  options: AssertionOptionsResponse;
  token: string;

  constructor(response: unknown) {
    super(response);
    this.options = new AssertionOptionsResponse(this.getResponseProperty("options"));
    this.token = this.getResponseProperty("token");
  }
}

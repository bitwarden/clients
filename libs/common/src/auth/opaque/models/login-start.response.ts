import { OpaqueSessionId } from "@bitwarden/common/types/guid";

import { BaseResponse } from "../../../models/response/base.response";

export class LoginStartResponse extends BaseResponse {
  sessionId: OpaqueSessionId;
  credentialResponse: string;

  constructor(response: any) {
    super(response);
    this.sessionId = this.getResponseProperty("SessionId");
    this.credentialResponse = this.getResponseProperty("CredentialResponse");
  }
}

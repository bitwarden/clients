import { Jsonify } from "type-fest";

import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { View } from "@bitwarden/common/models/view/view";

export class LoginViaAuthRequestView implements View {
  authRequest: AuthRequest | undefined = undefined;
  authRequestResponse: AuthRequestResponse | undefined = undefined;
  fingerprintPhrase: string | undefined = undefined;
  privateKey: string | undefined = undefined;
  publicKey: string | undefined = undefined;

  static fromJSON(obj: Partial<Jsonify<LoginViaAuthRequestView>>): LoginViaAuthRequestView {
    return Object.assign(new LoginViaAuthRequestView(), obj);
  }
}

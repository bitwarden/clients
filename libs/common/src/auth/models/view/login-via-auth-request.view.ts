import { Jsonify } from "type-fest";

import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { View } from "@bitwarden/common/models/view/view";

export class LoginViaAuthRequestView implements View {
  authRequest: AuthRequest | null = null;
  authRequestResponse: AuthRequestResponse | null = null;
  fingerprintPhrase: string | null = null;
  keys: { publicKey: Uint8Array; privateKey: Uint8Array } | null = null;

  static fromJSON(obj: Partial<Jsonify<LoginViaAuthRequestView>>): LoginViaAuthRequestView {
    return Object.assign(new LoginViaAuthRequestView(), obj);
  }
}

import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

export class LoginViaAuthRequestView implements View {
  id: string | undefined = undefined;
  accessCode: string | undefined = undefined;
  privateKey: string | undefined = undefined;

  static fromJSON(obj: Partial<Jsonify<LoginViaAuthRequestView>>): LoginViaAuthRequestView {
    return Object.assign(new LoginViaAuthRequestView(), obj);
  }
}

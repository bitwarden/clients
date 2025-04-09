import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

export class LoginViaAuthRequestView implements View {
  id: string | undefined = undefined;
  accessCode: string | undefined = undefined;
  privateKey: string | undefined = undefined;

  static fromJSON(obj: Partial<Jsonify<LoginViaAuthRequestView>>): LoginViaAuthRequestView | null {
    if (obj == null) {
      return null;
    }
    return Object.assign(new LoginViaAuthRequestView(), obj);
  }
}

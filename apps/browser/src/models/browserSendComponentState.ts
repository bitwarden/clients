// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

import { BrowserComponentState } from "./browserComponentState";

export class BrowserSendComponentState extends BrowserComponentState {
  sends: SendView[];

  static fromJSON(json: DeepJsonify<BrowserSendComponentState>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new BrowserSendComponentState(), json, {
      sends: json.sends?.map((s) => SendView.fromJSON(s)),
    });
  }
}

import { SendItemView as SdkSendItemView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { DeepJsonify } from "../../../../types/deep-jsonify";
import { CipherView } from "../../../../vault/models/view/cipher.view";

export class SendItemView implements View {
  data?: CipherView;

  static fromJSON(json: DeepJsonify<SendItemView>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendItemView(), json);
  }

  static fromSdk(obj: SdkSendItemView): SendItemView {
    const view = new SendItemView();
    view.data = CipherView.fromSdkCipherView(obj?.data);
    return view;
  }
}

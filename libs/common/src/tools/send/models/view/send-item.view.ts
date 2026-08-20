// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "../../../../models/view/view";
import { DeepJsonify } from "../../../../types/deep-jsonify";
import { CipherView } from "../../../../vault/models/view/cipher.view";

export class SendItemView implements View {
  data: CipherView;

  static fromJSON(json: DeepJsonify<SendItemView>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendItemView(), json);
  }
}

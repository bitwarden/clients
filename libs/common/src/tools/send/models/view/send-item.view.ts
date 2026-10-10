import { SendItemView as SdkSendItemView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";
import { DeepJsonify } from "../../../../types/deep-jsonify";
import { CipherView } from "../../../../vault/models/view/cipher.view";
import { SendItemMetadataData } from "../data/send-item-metadata.data";

export class SendItemView implements View {
  data?: CipherView;
  /** Unencrypted metadata carried alongside {@link data}; the SDK restores the item id from it. */
  metadata?: SendItemMetadataData;

  static fromJSON(json: DeepJsonify<SendItemView>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendItemView(), json, {
      data: json.data ? CipherView.fromJSON(json.data) : undefined,
    });
  }

  static fromSdk(obj: SdkSendItemView): SendItemView {
    const view = new SendItemView();
    view.data = CipherView.fromSdkCipherView(obj?.data);
    view.metadata = {
      itemId: uuidAsString(obj.metadata.itemId),
      creationDate: obj.metadata.creationDate,
      revisionDate: obj.metadata.revisionDate,
      folderName: obj.metadata.folderName,
      collectionNames: obj.metadata.collectionNames,
      organizationName: obj.metadata.organizationName,
    };
    return view;
  }
}

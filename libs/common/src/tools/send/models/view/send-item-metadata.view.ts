import { SendItemMetadataView as SdkSendItemMetadataView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";

/** Unencrypted metadata of an Item Send. */
export class SendItemMetadataView implements View {
  /** The id of the vault item being sent. */
  itemId?: string;
  /** The name of the folder the vault item being sent belongs to */
  folderName?: string;
  /** The names of the collections the vault item being sent belongs to */
  collectionNames?: string[];
  /** The name of the organization the vault item being sent belongs to */
  organizationName?: string;
  /** The date the vault item being sent was created */
  creationDate?: string;
  /** The date the vault item being sent was last edited */
  revisionDate?: string;

  static fromSdk(obj: SdkSendItemMetadataView): SendItemMetadataView | undefined {
    if (obj == null) {
      return undefined;
    }
    const view = new SendItemMetadataView();
    view.itemId = uuidAsString(obj.itemId);
    view.creationDate = obj.creationDate;
    view.revisionDate = obj.revisionDate;
    view.folderName = obj.folderName;
    view.collectionNames = obj.collectionNames;
    view.organizationName = obj.organizationName;
    return view;
  }
}

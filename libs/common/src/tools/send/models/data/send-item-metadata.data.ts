import { SendItemMetadataApi } from "../api/send-item-metadata.api";

/** Unencrypted metadata of an Item Send. */
export class SendItemMetadataData {
  /** Id of the vault item being sent. */
  itemId: string;

  constructor(data: SendItemMetadataApi) {
    this.itemId = data.itemId;
  }
}

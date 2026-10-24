import { SendItemMetadataApi } from "../api/send-item-metadata.api";

/** Unencrypted metadata of an Item Send. */
export class SendItemMetadataData {
  /** Id of the vault item being sent. */
  itemId: string;
  /** The name of the folder the vault item being sent belongs to */
  folderName?: string;
  /** The name of the collections the vault item being sent belongs to */
  collectionNames?: string[];
  /** The name of the organization the vault item being sent belongs to */
  organizationName?: string;
  /** The date the vault item being sent was created */
  creationDate: string;
  /** The date the vault item being sent was last edited */
  revisionDate: string;

  constructor(data: SendItemMetadataApi) {
    this.itemId = data.itemId;
    this.folderName = data.folderName;
    this.collectionNames = data.collectionNames;
    this.organizationName = data.organizationName;
    this.creationDate = data.creationDate;
    this.revisionDate = data.revisionDate;
  }
}

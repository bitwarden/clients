import { SendItemMetadataApi } from "../api/send-item-metadata.api";

/** Metadata of an Item Send. */
export class SendItemMetadataData {
  /** The unencrypted id of the vault item being sent. */
  itemId: string;
  /** The encrypted name of the folder the vault item being sent belongs to */
  folderName?: string;
  /** The encrypted names of the collections the vault item being sent belongs to */
  collectionNames?: string[];
  /** The unencrypted name of the organization the vault item being sent belongs to */
  organizationName?: string;
  /** The unencrypted date the vault item being sent was created */
  creationDate?: string;
  /** The unencrypted date the vault item being sent was last edited */
  revisionDate?: string;

  constructor(data: SendItemMetadataApi) {
    this.itemId = data.itemId;
    this.folderName = data.folderName;
    this.collectionNames = data.collectionNames;
    this.organizationName = data.organizationName;
    this.creationDate = data.creationDate;
    this.revisionDate = data.revisionDate;
  }
}

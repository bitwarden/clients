import { EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../../platform/models/domain/domain-base";
import { SendItemMetadataData } from "../data/send-item-metadata.data";

/** Partially encrypted metadata of an Item Send. */
export class SendItemMetadata extends Domain {
  /** The id of the vault item being sent. */
  itemId: string;
  /** The name of the folder the vault item being sent belongs to */
  folderName?: EncString;
  /** The names of the collections the vault item being sent belongs to */
  collectionNames?: EncString[];
  /** The name of the organization the vault item being sent belongs to */
  organizationName?: string;
  /** The date the vault item being sent was created */
  creationDate?: string;
  /** The date the vault item being sent was last edited */
  revisionDate?: string;

  constructor(data: SendItemMetadataData) {
    super();
    this.itemId = data.itemId;
    this.creationDate = data.creationDate;
    this.revisionDate = data.revisionDate;
    if (data.collectionNames) {
      this.collectionNames = data.collectionNames.map((cn) => cn as EncString);
    }
    if (data.folderName) {
      this.folderName = data.folderName as EncString;
    }
    this.organizationName = data.organizationName;
  }

  /** Serializes this domain `SendItemMetadata` to its `SendItemMetadataData` (string-shaped) form. */
  toSendData(): SendItemMetadataData {
    return {
      itemId: this.itemId,
      folderName: this.folderName ?? undefined,
      collectionNames: this.collectionNames?.map((cn) => cn),
      organizationName: this.organizationName,
      creationDate: this.creationDate,
      revisionDate: this.revisionDate,
    };
  }
}

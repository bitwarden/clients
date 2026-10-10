// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

import Domain from "../../../../platform/models/domain/domain-base";
import { SendItemMetadataData } from "../data/send-item-metadata.data";

/** Partially encrypted metadata of an Item Send. */
export class SendItemMetadata extends Domain {
  /** Id of the vault item being sent. */
  itemId: string;
  /** The name of the folder the vault item being sent belongs to */
  folderName?: EncString;
  /** The name of the collections the vault item being sent belongs to */
  collectionNames?: EncString[];
  /** The name of the organization the vault item being sent belongs to */
  organizationName?: EncString;
  /** The date the vault item being sent was created */
  creationDate: string;
  /** The date the vault item being sent was last edited */
  revisionDate: string;

  constructor(data: SendItemMetadataData) {
    super();
    this.itemId = data.itemId;
    this.creationDate = data.creationDate;
    this.revisionDate = data.revisionDate;
    if (data.collectionNames) {
      this.collectionNames = data.collectionNames.map((cn) => new EncString(cn));
    }
    if (data.folderName) {
      this.folderName = new EncString(data.folderName);
    }
    if (data.organizationName) {
      this.organizationName = new EncString(data.organizationName);
    }
  }
}

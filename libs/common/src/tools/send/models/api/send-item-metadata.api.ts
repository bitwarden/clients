import { BaseResponse } from "../../../../models/response/base.response";

/** Unencrypted metadata of an Item Send. */
export class SendItemMetadataApi extends BaseResponse {
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

  constructor(data: any = null) {
    super(data);
    this.itemId = this.getResponseProperty("ItemId");
    this.folderName = this.getResponseProperty("FolderName");
    this.collectionNames = this.getResponseProperty("CollectionNames");
    this.organizationName = this.getResponseProperty("OrganizationName");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

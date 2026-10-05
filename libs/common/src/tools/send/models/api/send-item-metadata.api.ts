import { BaseResponse } from "../../../../models/response/base.response";

/** Unencrypted metadata of an Item Send. */
export class SendItemMetadataApi extends BaseResponse {
  /** Id of the vault item being sent. */
  itemId: string;

  constructor(data: any = null) {
    super(data);
    this.itemId = this.getResponseProperty("ItemId");
  }
}

import { BaseResponse } from "../../../models/response/base.response";
import { Guid } from "../../../types/guid";

export class FolderResponse extends BaseResponse {
  id: Guid;
  name: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class NotificationViewResponse extends BaseResponse {
  id: any;
  priority: number;
  title: string;
  body: string;
  revisionDate: Date;
  readDate: Date;
  deletedDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.priority = this.getResponseProperty("Priority");
    this.title = this.getResponseProperty("Title");
    this.body = this.getResponseProperty("Body");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.readDate = this.getResponseProperty("ReadDate");
    this.deletedDate = this.getResponseProperty("DeletedDate");
  }
}

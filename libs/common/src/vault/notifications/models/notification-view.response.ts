import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { NotificationId, SecurityTaskId } from "@bitwarden/common/types/guid";

export class NotificationViewResponse extends BaseResponse {
  id: NotificationId;
  priority: number;
  title: string;
  body: string;
  date: Date;
  taskId?: SecurityTaskId;
  readDate: Date;
  deletedDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.priority = this.getResponseProperty("Priority");
    this.title = this.getResponseProperty("Title");
    this.body = this.getResponseProperty("Body");
    this.date = this.getResponseProperty("Date");
    this.taskId = this.getResponseProperty("TaskId");
    this.readDate = this.getResponseProperty("ReadDate");
    this.deletedDate = this.getResponseProperty("DeletedDate");
  }
}

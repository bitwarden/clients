import { NotificationId, SecurityTaskId } from "@bitwarden/common/types/guid";

export class NotificationView {
  id: NotificationId;
  priority: number;
  title: string;
  body: string;
  date: Date;
  taskId?: SecurityTaskId;
  readDate: Date | null;
  deletedDate: Date | null;

  constructor(obj: any) {
    this.id = obj.id;
    this.priority = obj.priority;
    this.title = obj.title;
    this.body = obj.body;
    this.date = obj.date;
    this.taskId = obj.taskId;
    this.readDate = obj.readDate;
    this.deletedDate = obj.deletedDate;
  }
}

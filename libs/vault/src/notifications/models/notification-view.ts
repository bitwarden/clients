import { NotificationId } from "@bitwarden/common/types/guid";

export class NotificationView {
  id: NotificationId;
  priority: number;
  title: string;
  body: string;
  revisionDate: Date;
  readDate: Date;
  deletedDate: Date;

  constructor(obj: any) {
    this.id = obj.id;
    this.priority = obj.priority;
    this.title = obj.title;
    this.body = obj.body;
    this.revisionDate = new Date(obj.revisionDate);
    this.readDate = new Date(obj.readDate);
    this.deletedDate = new Date(obj.deletedDate);
  }
}

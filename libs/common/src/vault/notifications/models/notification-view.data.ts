import { Jsonify } from "type-fest";

import { NotificationId, SecurityTaskId } from "@bitwarden/common/types/guid";

import { NotificationViewResponse } from "./notification-view.response";

export class NotificationViewData {
  id: NotificationId;
  priority: number;
  title: string;
  body: string;
  date: Date;
  taskId?: SecurityTaskId;
  readDate: Date | null;
  deletedDate: Date | null;

  constructor(response: NotificationViewResponse) {
    this.id = response.id;
    this.priority = response.priority;
    this.title = response.title;
    this.body = response.body;
    this.date = response.date;
    this.taskId = response.taskId;
    this.readDate = response.readDate;
    this.deletedDate = response.deletedDate;
  }

  static fromJSON(obj: Jsonify<NotificationViewData>) {
    return Object.assign(new NotificationViewData({} as NotificationViewResponse), obj, {
      id: obj.id,
      priority: obj.priority,
      title: obj.title,
      body: obj.body,
      date: new Date(obj.date),
      taskId: obj.taskId,
      readDate: obj.readDate ? new Date(obj.readDate) : null,
      deletedDate: obj.deletedDate ? new Date(obj.deletedDate) : null,
    });
  }
}

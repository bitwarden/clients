import { Jsonify } from "type-fest";

import { NotificationViewResponse } from "./notification-view.response";

export class NotificationViewData {
  id: any;
  priority: number;
  title: string;
  body: string;
  revisionDate: Date;
  readDate: Date;
  deletedDate: Date;

  constructor(response: NotificationViewResponse) {
    this.id = response.id;
    this.priority = response.priority;
    this.title = response.title;
    this.body = response.body;
    this.revisionDate = response.revisionDate;
    this.readDate = response.readDate;
    this.deletedDate = response.deletedDate;
  }

  static fromJSON(obj: Jsonify<NotificationViewData>) {
    return Object.assign(new NotificationViewData({} as NotificationViewResponse), obj, {
      id: obj.id,
      priority: obj.priority,
      title: obj.title,
      body: obj.body,
      revisionDate: new Date(obj.revisionDate),
      readDate: new Date(obj.readDate),
      deletedDate: new Date(obj.deletedDate),
    });
  }
}

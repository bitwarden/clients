import { EventSystemUser, EventType } from "../../enums";

export class EventView {
  message: string;
  humanReadableMessage: string;
  appIcon: string;
  appName: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  ip: string;
  type: EventType;
  installationId: string;
  systemUser: EventSystemUser;
  serviceAccountId: string;

  constructor(data: Required<EventView>) {
    this.message = data.message;
    this.humanReadableMessage = data.humanReadableMessage;
    this.appIcon = data.appIcon;
    this.appName = data.appName;
    this.userId = data.userId;
    this.userName = data.userName;
    this.userEmail = data.userEmail;
    this.date = data.date;
    this.ip = data.ip;
    this.type = data.type;
    this.installationId = data.installationId;
    this.systemUser = data.systemUser;
    this.serviceAccountId = data.serviceAccountId;
  }
}

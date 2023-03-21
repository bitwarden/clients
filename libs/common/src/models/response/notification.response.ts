import { NotificationType } from "../../enums/notificationType";
import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class NotificationResponse extends BaseResponse {
  contextId: string;
  type: NotificationType;
  payload: any;

  constructor(response: any) {
    super(response);
    this.contextId = this.getResponseProperty("ContextId");
    this.type = this.getResponseProperty("Type");

    const payload = this.getResponseProperty("Payload");
    switch (this.type) {
      case NotificationType.SyncCipherCreate:
      case NotificationType.SyncCipherDelete:
      case NotificationType.SyncCipherUpdate:
      case NotificationType.SyncLoginDelete:
        this.payload = new SyncCipherNotification(payload);
        break;
      case NotificationType.SyncFolderCreate:
      case NotificationType.SyncFolderDelete:
      case NotificationType.SyncFolderUpdate:
        this.payload = new SyncFolderNotification(payload);
        break;
      case NotificationType.SyncVault:
      case NotificationType.SyncCiphers:
      case NotificationType.SyncOrgKeys:
      case NotificationType.SyncSettings:
      case NotificationType.LogOut:
        this.payload = new UserNotification(payload);
        break;
      case NotificationType.SyncSendCreate:
      case NotificationType.SyncSendUpdate:
      case NotificationType.SyncSendDelete:
        this.payload = new SyncSendNotification(payload);
        break;
      case NotificationType.AuthRequest:
      case NotificationType.AuthRequestResponse:
        this.payload = new AuthRequestPushNotification(payload);
        break;
      default:
        break;
    }
  }
}

export class SyncCipherNotification extends BaseResponse {
  id: Guid;
  userId: Guid;
  organizationId: Guid;
  collectionIds: Guid[];
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.collectionIds = this.getResponseProperty<Guid[]>("CollectionIds");
    this.revisionDate = new Date(this.getResponseProperty("RevisionDate"));
  }
}

export class SyncFolderNotification extends BaseResponse {
  id: Guid;
  userId: Guid;
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.revisionDate = new Date(this.getResponseProperty("RevisionDate"));
  }
}

export class UserNotification extends BaseResponse {
  userId: Guid;
  date: Date;

  constructor(response: any) {
    super(response);
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.date = new Date(this.getResponseProperty("Date"));
  }
}

export class SyncSendNotification extends BaseResponse {
  id: Guid;
  userId: Guid;
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.revisionDate = new Date(this.getResponseProperty("RevisionDate"));
  }
}

export class AuthRequestPushNotification extends BaseResponse {
  id: Guid;
  userId: Guid;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.userId = this.getResponseProperty<Guid>("UserId");
  }
}

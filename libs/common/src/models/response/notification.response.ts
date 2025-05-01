import { NotificationViewResponse as EndUserNotificationResponse } from "@bitwarden/common/vault/notifications/models";

import { NotificationType } from "../../enums";

import { BaseResponse } from "./base.response";

export class NotificationResponse extends BaseResponse {
  contextId: string;
  type: NotificationType;
  payload: any;

  constructor(response: any) {
    super(response);
    this.contextId = this.getResponseProperty("ContextId");
    this.type = this.getResponseProperty("Type");

    let payload = this.getResponseProperty("Payload");

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        // guess it was a string
      }
    }

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
      case NotificationType.SyncOrganizations:
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
      case NotificationType.SyncOrganizationStatusChanged:
        this.payload = new OrganizationStatusPushNotification(payload);
        break;
      case NotificationType.SyncOrganizationCollectionSettingChanged:
        this.payload = new OrganizationCollectionSettingChangedPushNotification(payload);
        break;
      case NotificationType.Notification:
      case NotificationType.NotificationStatus:
        this.payload = new EndUserNotificationResponse(payload);
        break;
      default:
        break;
    }
  }
}

export class SyncCipherNotification extends BaseResponse {
  id: string;
  userId: string;
  organizationId: string;
  collectionIds: string[];
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.collectionIds = this.getResponseProperty("CollectionIds");
    this.revisionDate = new Date(this.getResponseProperty("RevisionDate"));
  }
}

export class SyncFolderNotification extends BaseResponse {
  id: string;
  userId: string;
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.revisionDate = new Date(this.getResponseProperty("RevisionDate"));
  }
}

export class UserNotification extends BaseResponse {
  userId: string;
  date: Date;

  constructor(response: any) {
    super(response);
    this.userId = this.getResponseProperty("UserId");
    this.date = new Date(this.getResponseProperty("Date"));
  }
}

export class SyncSendNotification extends BaseResponse {
  id: string;
  userId: string;
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.revisionDate = new Date(this.getResponseProperty("RevisionDate"));
  }
}

export class AuthRequestPushNotification extends BaseResponse {
  id: string;
  userId: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
  }
}

export class OrganizationStatusPushNotification extends BaseResponse {
  organizationId: string;
  enabled: boolean;

  constructor(response: any) {
    super(response);
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.enabled = this.getResponseProperty("Enabled");
  }
}

export class OrganizationCollectionSettingChangedPushNotification extends BaseResponse {
  organizationId: string;
  limitCollectionCreation: boolean;
  limitCollectionDeletion: boolean;

  constructor(response: any) {
    super(response);

    this.organizationId = this.getResponseProperty("OrganizationId");
    this.limitCollectionCreation = this.getResponseProperty("LimitCollectionCreation");
    this.limitCollectionDeletion = this.getResponseProperty("LimitCollectionDeletion");
  }
}

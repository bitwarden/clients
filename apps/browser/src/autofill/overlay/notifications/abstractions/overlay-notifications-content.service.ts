import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationTaskInfo } from "../../../notification/abstractions/notification-bar";

export type NotificationTypeData = {
  isVaultLocked?: boolean;
  theme?: Theme;
  removeIndividualVault?: boolean;
  importType?: string;
  launchTimestamp?: number;
};

type OpenNotificationBarMessage = {
  command: "openNotificationBar";
  data: {
    type: string;
    typeData: NotificationTypeData;
    params?: object;
  };
};

type CloseNotificationBarMessage = {
  command: "closeNotificationBar";
  data?: {
    closedByUser?: boolean;
    fadeOutNotification?: boolean;
  };
};

type SaveCipherAttemptCompletedMessage = {
  command: "saveCipherAttemptCompleted";
  data?: {
    error?: string;
    cipherId?: string;
    task?: NotificationTaskInfo;
    itemName?: string;
  };
};

export type NotificationsExtensionMessage =
  | OpenNotificationBarMessage
  | CloseNotificationBarMessage
  | SaveCipherAttemptCompletedMessage;

type OverlayNotificationsExtensionMessageParam = {
  message: NotificationsExtensionMessage;
};
type OverlayNotificationsExtensionSenderParam = {
  sender: chrome.runtime.MessageSender;
};
export type OverlayNotificationsExtensionMessageParams = OverlayNotificationsExtensionMessageParam &
  OverlayNotificationsExtensionSenderParam;

export type OverlayNotificationsExtensionMessageHandlers = {
  [key: string]: ({ message, sender }: OverlayNotificationsExtensionMessageParams) => any;
  openNotificationBar: ({ message }: OverlayNotificationsExtensionMessageParam) => void;
  closeNotificationBar: ({ message }: OverlayNotificationsExtensionMessageParam) => void;
  saveCipherAttemptCompleted: ({ message }: OverlayNotificationsExtensionMessageParam) => void;
};

export interface OverlayNotificationsContentService {
  messageHandlers: OverlayNotificationsExtensionMessageHandlers;
  destroy: () => void;
}

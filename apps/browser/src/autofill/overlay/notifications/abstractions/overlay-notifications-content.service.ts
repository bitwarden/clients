import { Theme } from "@bitwarden/common/platform/enums";

export type NotificationTypeData = {
  isVaultLocked?: boolean;
  theme?: Theme;
  removeIndividualVault?: boolean;
  importType?: string;
  launchTimestamp?: number;
};

export type NotificationsExtensionMessage = {
  command: string;
  data?: {
    type?: string;
    typeData?: NotificationTypeData;
    height?: number;
    error?: string;
    closedByUser?: boolean;
    fadeOutNotification?: boolean;
    params: object;
  };
};

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
  adjustNotificationBar: ({ message }: OverlayNotificationsExtensionMessageParam) => void;
  saveCipherAttemptCompleted: ({ message }: OverlayNotificationsExtensionMessageParam) => void;
};

export interface OverlayNotificationsContentService {
  messageHandlers: OverlayNotificationsExtensionMessageHandlers;
  destroy: () => void;
}

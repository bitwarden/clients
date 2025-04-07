import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { NotificationQueueMessageTypes } from "../../enums/notification-queue-message-type.enum";
import AutofillPageDetails from "../../models/autofill-page-details";

interface NotificationQueueMessage {
  type: NotificationQueueMessageTypes;
  domain: string;
  tab: chrome.tabs.Tab;
  launchTimestamp: number;
  expires: Date;
  wasVaultLocked: boolean;
}

interface AddChangePasswordQueueMessage extends NotificationQueueMessage {
  type: "change";
  cipherId: string;
  newPassword: string;
}

interface AddLoginQueueMessage extends NotificationQueueMessage {
  type: "add";
  username: string;
  password: string;
  uri: string;
}

interface AddUnlockVaultQueueMessage extends NotificationQueueMessage {
  type: "unlock";
}

type NotificationQueueMessageItem =
  | AddLoginQueueMessage
  | AddChangePasswordQueueMessage
  | AddUnlockVaultQueueMessage;

type LockedVaultPendingNotificationsData = {
  commandToRetry: {
    message: {
      command: string;
      contextMenuOnClickData?: chrome.contextMenus.OnClickData;
      folder?: string;
      edit?: boolean;
    };
    sender: chrome.runtime.MessageSender;
  };
  target: string;
};

type AdjustNotificationBarMessageData = {
  height: number;
};

type ChangePasswordMessageData = {
  currentPassword: string;
  newPassword: string;
  url: string;
};

type AddLoginMessageData = {
  username: string;
  password: string;
  url: string;
};

type UnlockVaultMessageData = {
  skipNotification?: boolean;
};

type NotificationBackgroundExtensionMessage = {
  [key: string]: any;
  command: string;
  data?: Partial<LockedVaultPendingNotificationsData> &
    Partial<AdjustNotificationBarMessageData> &
    Partial<ChangePasswordMessageData> &
    Partial<UnlockVaultMessageData>;
  login?: AddLoginMessageData;
  folder?: string;
  edit?: boolean;
  details?: AutofillPageDetails;
  tab?: chrome.tabs.Tab;
  sender?: string;
  notificationType?: string;
  fadeOutNotification?: boolean;
};

type BackgroundMessageParam = { message: NotificationBackgroundExtensionMessage };
type BackgroundSenderParam = { sender: chrome.runtime.MessageSender };
type BackgroundOnMessageHandlerParams = BackgroundMessageParam & BackgroundSenderParam;

type NotificationBackgroundExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  unlockCompleted: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgGetFolderData: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<FolderView[]>;
  bgCloseNotificationBar: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgAdjustNotificationBar: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgAddLogin: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgChangedPassword: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgRemoveTabFromNotificationQueue: ({ sender }: BackgroundSenderParam) => void;
  bgSaveCipher: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  bgOpenVault: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgNeverSave: ({ sender }: BackgroundSenderParam) => Promise<void>;
  bgUnlockPopoutOpened: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgReopenUnlockPopout: ({ sender }: BackgroundSenderParam) => Promise<void>;
  checkNotificationQueue: ({ sender }: BackgroundSenderParam) => Promise<void>;
  collectPageDetailsResponse: ({ message }: BackgroundMessageParam) => Promise<void>;
  bgGetEnableChangedPasswordPrompt: () => Promise<boolean>;
  bgGetEnableAddedLoginPrompt: () => Promise<boolean>;
  bgGetExcludedDomains: () => Promise<NeverDomains>;
  bgGetActiveUserServerConfig: () => Promise<ServerConfig>;
  getWebVaultUrlForNotification: () => Promise<string>;
};

export {
  AddChangePasswordQueueMessage,
  AddLoginQueueMessage,
  AddUnlockVaultQueueMessage,
  NotificationQueueMessageItem,
  LockedVaultPendingNotificationsData,
  AdjustNotificationBarMessageData,
  ChangePasswordMessageData,
  UnlockVaultMessageData,
  AddLoginMessageData,
  NotificationBackgroundExtensionMessage,
  NotificationBackgroundExtensionMessageHandlers,
};

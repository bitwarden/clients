import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { SecurityTask } from "@bitwarden/common/vault/tasks";

import { CollectionView } from "../../content/components/common-types";
import AutofillPageDetails from "../../models/autofill-page-details";

const StandardNotificationType = {
  AddLogin: "add",
  ChangePassword: "change",
  UnlockVault: "unlock",
  AtRiskPassword: "at-risk-password",
  Generic: "generic",
} as const;

type StandardNotificationTypes =
  (typeof StandardNotificationType)[keyof typeof StandardNotificationType];

interface NotificationQueueMessage {
  type: StandardNotificationTypes;
  domain: string;
  tab: chrome.tabs.Tab;
  launchTimestamp: number;
  expires: Date;
  wasVaultLocked: boolean;
}

export interface TempNotificationQueueMessage<T, D> {
  domain: string;
  tab: chrome.tabs.Tab;
  launchTimestamp: number;
  expires: Date;
  wasVaultLocked: boolean;
  type: T;
  data: D;
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

interface AtRiskPasswordQueueMessage extends NotificationQueueMessage {
  type: "at-risk-password";
  organizationName: string;
  passwordChangeUri?: string;
}

export type GenericNotificationData = {
  message: string;
};

export type GenericNotificationQueueMessage = TempNotificationQueueMessage<
  typeof StandardNotificationType.Generic,
  GenericNotificationData
>;

type NotificationQueueMessageItem =
  | AddLoginQueueMessage
  | AddChangePasswordQueueMessage
  | AddUnlockVaultQueueMessage
  | AtRiskPasswordQueueMessage
  | GenericNotificationQueueMessage;

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

type AtRiskPasswordNotificationsData = {
  activeUserId: UserId;
  cipher: CipherView;
  securityTask: SecurityTask;
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

type NotificationBackgroundExtensionMessage<D> = {
  [key: string]: any;
  command: string;
  data?: D;
  login?: AddLoginMessageData;
  folder?: string;
  edit?: boolean;
  details?: AutofillPageDetails;
  tab?: chrome.tabs.Tab;
  sender?: string;
  notificationType?: string;
  organizationId?: string;
  fadeOutNotification?: boolean;
};

type BackgroundMessageParam = { message: NotificationBackgroundExtensionMessage<any> };
type BackgroundSenderParam = { sender: chrome.runtime.MessageSender };
type BackgroundOnMessageHandlerParams = BackgroundMessageParam & BackgroundSenderParam;

type NotificationBackgroundExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  unlockCompleted: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgGetFolderData: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<FolderView[]>;
  bgGetCollectionData: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<CollectionView[]>;
  bgCloseNotificationBar: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgOpenAtRisksPasswordNotification: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgOpenAtRisksPasswords: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgAdjustNotificationBar: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgAddLogin: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgChangedPassword: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgRemoveTabFromNotificationQueue: ({ sender }: BackgroundSenderParam) => void;
  bgSaveCipher: ({ message, sender }: BackgroundOnMessageHandlerParams) => void;
  bgOpenAddEditVaultItemPopout: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgOpenViewVaultItemPopout: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<void>;
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
  StandardNotificationType,
  StandardNotificationTypes,
  AddChangePasswordQueueMessage,
  AddLoginMessageData,
  AddLoginQueueMessage,
  AddUnlockVaultQueueMessage,
  AdjustNotificationBarMessageData,
  AtRiskPasswordNotificationsData,
  ChangePasswordMessageData,
  LockedVaultPendingNotificationsData,
  NotificationBackgroundExtensionMessage,
  NotificationBackgroundExtensionMessageHandlers,
  NotificationQueueMessageItem,
  UnlockVaultMessageData,
};

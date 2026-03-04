import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { CollectionView } from "../../content/components/common-types";
import { NotificationType } from "../../enums/notification-type.enum";
import AutofillPageDetails from "../../models/autofill-page-details";

/**
 * Generic notification queue message structure.
 * All notification types use this structure with type-specific data.
 */
export interface NotificationQueueMessage<T, D> {
  domain: string;
  tab: chrome.tabs.Tab;
  launchTimestamp: number;
  expires: Date;
  wasVaultLocked: boolean;
  type: T;
  data: D;
}

// Notification data type definitions
export type AddLoginNotificationData = {
  username: string;
  password: string;
  uri: string;
};

export type ChangePasswordNotificationData = {
  cipherIds: CipherView["id"][];
  newPassword: string;
};

export type UnlockVaultNotificationData = never;

export type AtRiskPasswordNotificationData = {
  organizationName: string;
  passwordChangeUri?: string;
};

// Notification queue message types using generic pattern
export type AddLoginQueueMessage = NotificationQueueMessage<
  typeof NotificationType.AddLogin,
  AddLoginNotificationData
>;

export type AddChangePasswordNotificationQueueMessage = NotificationQueueMessage<
  typeof NotificationType.ChangePassword,
  ChangePasswordNotificationData
>;

export type AddUnlockVaultQueueMessage = NotificationQueueMessage<
  typeof NotificationType.UnlockVault,
  UnlockVaultNotificationData
>;

export type AtRiskPasswordQueueMessage = NotificationQueueMessage<
  typeof NotificationType.AtRiskPassword,
  AtRiskPasswordNotificationData
>;

export type NotificationQueueMessageItem =
  | AddLoginQueueMessage
  | AddChangePasswordNotificationQueueMessage
  | AddUnlockVaultQueueMessage
  | AtRiskPasswordQueueMessage;

export type LockedVaultPendingNotificationsData = {
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

export type AdjustNotificationBarMessageData = {
  height: number;
};

export type AddLoginMessageData = {
  username: string;
  password: string;
  url: string;
};

export type UnlockVaultMessageData = {
  skipNotification?: boolean;
};

/**
 * @todo Extend generics to this type, see NotificationQueueMessage
 * - use new `data` types as generic
 * - eliminate optional status of properties as needed per Notification Type
 */
export type NotificationBackgroundExtensionMessage = {
  [key: string]: any;
  command: string;
  data?: Partial<LockedVaultPendingNotificationsData> &
    Partial<AdjustNotificationBarMessageData> &
    Partial<UnlockVaultMessageData>;
  folder?: string;
  edit?: boolean;
  details?: AutofillPageDetails;
  tab?: chrome.tabs.Tab;
  sender?: string;
  notificationType?: string;
  organizationId?: string;
  fadeOutNotification?: boolean;
};

type BackgroundMessageParam = { message: NotificationBackgroundExtensionMessage };
type BackgroundSenderParam = { sender: chrome.runtime.MessageSender };
type BackgroundOnMessageHandlerParams = BackgroundMessageParam & BackgroundSenderParam;

export type NotificationBackgroundExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  unlockCompleted: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgGetFolderData: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<FolderView[]>;
  bgGetCollectionData: ({
    message,
    sender,
  }: BackgroundOnMessageHandlerParams) => Promise<CollectionView[]>;
  bgCloseNotificationBar: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgOpenAtRiskPasswords: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
  bgAdjustNotificationBar: ({ message, sender }: BackgroundOnMessageHandlerParams) => Promise<void>;
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
  bgReopenUnlockPopout: ({ sender }: BackgroundSenderParam) => Promise<void>;
  checkNotificationQueue: ({ sender }: BackgroundSenderParam) => Promise<void>;
  collectPageDetailsResponse: ({ message }: BackgroundMessageParam) => Promise<void>;
  bgGetEnableChangedPasswordPrompt: () => Promise<boolean>;
  bgGetEnableAddedLoginPrompt: () => Promise<boolean>;
  bgGetExcludedDomains: () => Promise<NeverDomains>;
  bgGetActiveUserServerConfig: () => Promise<ServerConfig | null>;
  getWebVaultUrlForNotification: () => Promise<string>;
};

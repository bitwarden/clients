import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { CollectionView } from "../../content/components/common-types";
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
  cipherId: CipherView["id"];
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

type NotificationQueueMessageItem =
  | AddLoginQueueMessage
  | AddChangePasswordQueueMessage
  | AddUnlockVaultQueueMessage
  | AtRiskPasswordQueueMessage;

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

type NotificationBackgroundExtensionMessageHandlers = {
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
  UnlockVaultMessageData,
  AddLoginMessageData,
  NotificationBackgroundExtensionMessage,
  NotificationBackgroundExtensionMessageHandlers,
};

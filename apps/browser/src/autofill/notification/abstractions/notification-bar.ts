import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationCipherData } from "../../../autofill/content/components/cipher/types";
import {
  FolderView,
  OrgView,
  CollectionView,
} from "../../../autofill/content/components/common-types";

const NotificationTypes = {
  Add: "add",
  Change: "change",
  Unlock: "unlock",
  AtRiskPassword: "at-risk-password",
} as const;

/**
 * @todo Deprecate in favor of apps/browser/src/autofill/enums/notification-type.enum.ts
 * - Determine fix or workaround for restricted imports of that file.
 */
type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

type NotificationTaskInfo = {
  orgName: string;
  remainingTasksCount: number;
};

/**
 * @todo Use generics to make this type specific to notification types, see Standard_NotificationQueueMessage.
 */
type NotificationBarIframeInitData = {
  ciphers?: NotificationCipherData[];
  folders?: FolderView[];
  collections?: CollectionView[];
  importType?: string;
  isVaultLocked?: boolean;
  launchTimestamp?: number;
  organizations?: OrgView[];
  removeIndividualVault?: boolean;
  theme?: Theme;
  type?: NotificationType;
  params?: AtRiskPasswordNotificationParams | any;
};

type NotificationBarWindowMessage = {
  command: string;
  data?: {
    cipherId?: string;
    task?: NotificationTaskInfo;
    itemName?: string;
  };
  error?: string;
  initData?: NotificationBarIframeInitData;
};

type NotificationBarWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initNotificationBar: ({ message }: { message: NotificationBarWindowMessage }) => void;
  saveCipherAttemptCompleted: ({ message }: { message: NotificationBarWindowMessage }) => void;
};

type AtRiskPasswordNotificationParams = {
  passwordChangeUri?: string;
  organizationName: string;
};

export {
  AtRiskPasswordNotificationParams,
  NotificationTaskInfo,
  NotificationTypes,
  NotificationType,
  NotificationBarIframeInitData,
  NotificationBarWindowMessage,
  NotificationBarWindowMessageHandlers,
};

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

type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

type NotificationTaskInfo = {
  orgName: string;
  remainingTasksCount: number;
};

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
  command: symbol;
  data?: {
    cipherId?: string;
    task?: NotificationTaskInfo;
    itemName?: string;
  };
  error?: string;
  initData?: NotificationBarIframeInitData;
};

export const INIT_NOTIFICATION_BAR = Symbol("initNotificationBar");
export const SAVE_CIPHER_ATTEMPT_COMPLETED = Symbol("saveCipherAttemptCompleted");

type NotificationBarWindowMessageHandlers = {
  [key: symbol]: CallableFunction;
  [INIT_NOTIFICATION_BAR]: ({ message }: { message: NotificationBarWindowMessage }) => void;
  [SAVE_CIPHER_ATTEMPT_COMPLETED]: ({ message }: { message: NotificationBarWindowMessage }) => void;
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

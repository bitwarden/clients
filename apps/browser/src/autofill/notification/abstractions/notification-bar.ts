import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationCipherData } from "../../../autofill/content/components/cipher/types";
import { FolderView, OrgView } from "../../../autofill/content/components/common-types";

const NotificationTypes = {
  Add: "add",
  Change: "change",
  Unlock: "unlock",
} as const;

type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

type NotificationTaskInfo = {
  orgName: string;
  remainingTasksCount: number;
};

type NotificationBarIframeInitData = {
  ciphers?: NotificationCipherData[];
  folders?: FolderView[];
  importType?: string;
  isVaultLocked?: boolean;
  launchTimestamp?: number;
  organizations?: OrgView[];
  removeIndividualVault?: boolean;
  theme?: Theme;
  type?: string; // @TODO use `NotificationType`
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

export {
  NotificationTaskInfo,
  NotificationTypes,
  NotificationType,
  NotificationBarIframeInitData,
  NotificationBarWindowMessage,
  NotificationBarWindowMessageHandlers,
};

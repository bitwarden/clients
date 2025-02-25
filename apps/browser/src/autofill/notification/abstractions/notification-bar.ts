import { Theme } from "@bitwarden/common/platform/enums";

const NotificationTypes = {
  Add: "add",
  Change: "change",
  Unlock: "unlock",
} as const;

type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

type NotificationBarIframeInitData = {
  type?: string; // @TODO use `NotificationType`
  isVaultLocked?: boolean;
  theme?: Theme;
  removeIndividualVault?: boolean;
  importType?: string;
  applyRedesign?: boolean;
  launchTimestamp?: number;
};

type NotificationBarWindowMessage = {
  command: string;
  error?: string;
  initData?: NotificationBarIframeInitData;
  username?: string;
  cipherId?: string;
};

type NotificationBarWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initNotificationBar: ({ message }: { message: NotificationBarWindowMessage }) => void;
  saveCipherAttemptCompleted: ({ message }: { message: NotificationBarWindowMessage }) => void;
};

export {
  NotificationTypes,
  NotificationType,
  NotificationBarIframeInitData,
  NotificationBarWindowMessage,
  NotificationBarWindowMessageHandlers,
};

import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationCipherData } from "../../../autofill/content/components/cipher/types";
import {
  FolderView,
  OrgView,
  CollectionView,
} from "../../../autofill/content/components/common-types";

const NotificationTypes = {
  /** represents scenarios handling saving new ciphers after form submit */
  Add: "add",
  /** represents scenarios handling saving updated ciphers after form submit */
  Change: "change",
  /** represents scenarios where user has interacted with an unlock action prompt or action otherwise requiring unlock as a prerequisite */
  Unlock: "unlock",
  /** represents scenarios where the user has security tasks after updating ciphers */
  AtRiskPassword: "at-risk-password",
} as const;

/**
 * @todo Deprecate in favor of apps/browser/src/autofill/enums/notification-type.enum.ts
 * - Determine fix or workaround for restricted imports of that file.
 */
type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

type NotificationTaskInfo = {
  orgName?: string;
  remainingTasksCount: number;
};

/**
 * Init data projected into the notification bar iframe when a queued notification is ready to
 * display.
 *
 * `type` is the primary discriminant: it determines which notification component renders in `bar.ts`.
 */
// FIXME: Use type guards to specialize this type into subtypes keyed on `type`; once
// all patterns are known, replace type guards with a discriminated union.
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
  /** The notification discriminant. Determines which component renders. */
  type?: NotificationType;
  showAnimations?: boolean;
  /**
   * Type-erased payload for the notification.
   * Use type guards like `isAtRiskPasswordNotification` to read this field.
   */
  params?: AtRiskPasswordNotificationParams | unknown;
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
  parentOrigin?: string;
};

type NotificationBarWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initNotificationBar: ({ message }: { message: NotificationBarWindowMessage }) => void;
  saveCipherAttemptCompleted: ({ message }: { message: NotificationBarWindowMessage }) => void;
};

/**
 * Type-specific payload for at-risk-password notifications.
 *
 * `organizationName` is always present — it is resolved from the organization record before the
 * notification is queued.
 *
 * `hasPasswordChangeUri` indicates whether the site advertises a `.well-known/change-password`
 * endpoint. When `true`, the notification renders a "Change password" button whose click is
 * handled by the background service (which re-derives the trusted URL). When `false`, the
 * notification body instructs the user to navigate to the site manually.
 */
type AtRiskPasswordNotificationParams = {
  hasPasswordChangeUri: boolean;
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

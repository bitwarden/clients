import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTask } from "@bitwarden/common/vault/tasks";

import AutofillPageDetails from "../../models/autofill-page-details";
import { NotificationTypes } from "../../notification/abstractions/notification-bar";

export type NotificationTypeData = {
  isVaultLocked?: boolean;
  theme?: string;
  removeIndividualVault?: boolean;
  importType?: string;
  launchTimestamp?: number;
};

export type LoginSecurityTaskInfo = {
  securityTask: SecurityTask;
  cipher: CipherView;
  uri: ModifyLoginCipherFormData["uri"];
};

/**
 * Distinguished from `NotificationTypes` in that this represents the
 * pre-resolved notification scenario, vs the notification component
 * (e.g. "Add" and "Change" will be removed
 * post-`useUndeterminedCipherScenarioTriggeringLogic` migration)
 */
export const NotificationScenarios = {
  ...NotificationTypes,
  /** represents scenarios handling saving new and updated ciphers after form submit */
  Cipher: "cipher",
} as const;

export type NotificationScenario =
  (typeof NotificationScenarios)[keyof typeof NotificationScenarios];

export type WebsiteOriginsWithFields = Map<chrome.tabs.Tab["id"], Set<string>>;

export type ActiveFormSubmissionRequests = Set<chrome.webRequest.WebRequestDetails["requestId"]>;

/** This type represents an expectation of nullish values being represented as empty strings */
export type ModifyLoginCipherFormData = {
  uri: string;
  username: string;
  password: string;
  newPassword: string;
};

export type ModifyLoginCipherFormDataForTab = Map<chrome.tabs.Tab["id"], ModifyLoginCipherFormData>;

export type OverlayNotificationsExtensionMessage = {
  command: string;
  details?: AutofillPageDetails;
} & ModifyLoginCipherFormData;

type OverlayNotificationsMessageParams = { message: OverlayNotificationsExtensionMessage };
type OverlayNotificationSenderParams = { sender: chrome.runtime.MessageSender };
type OverlayNotificationsMessageHandlersParams = OverlayNotificationsMessageParams &
  OverlayNotificationSenderParams;

export type OverlayNotificationsExtensionMessageHandlers = {
  [key: string]: ({ message, sender }: OverlayNotificationsMessageHandlersParams) => any;
  formFieldSubmitted: ({ message, sender }: OverlayNotificationsMessageHandlersParams) => void;
  collectPageDetailsResponse: ({
    message,
    sender,
  }: OverlayNotificationsMessageHandlersParams) => Promise<void>;
};

export interface OverlayNotificationsBackground {
  init(): void;
}

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTask } from "@bitwarden/common/vault/tasks";

import AutofillPageDetails from "../../models/autofill-page-details";

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

export type WebsiteOriginsWithFields = Map<chrome.tabs.Tab["id"], Set<string>>;

export type ActiveFormSubmissionRequests = Set<chrome.webRequest.WebRequestDetails["requestId"]>;

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

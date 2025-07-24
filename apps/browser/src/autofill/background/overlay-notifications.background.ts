// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Subject, switchMap, timer } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { CLEAR_NOTIFICATION_LOGIN_DATA_DURATION } from "@bitwarden/common/autofill/constants";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTask, SecurityTaskStatus, TaskService } from "@bitwarden/common/vault/tasks";

import { BrowserApi } from "../../platform/browser/browser-api";
import { generateDomainMatchPatterns, isInvalidResponseStatusCode } from "../utils";

import {
  ActiveFormSubmissionRequests,
  ModifyLoginCipherFormData,
  ModifyLoginCipherFormDataForTab,
  OverlayNotificationsBackground as OverlayNotificationsBackgroundInterface,
  OverlayNotificationsExtensionMessage,
  OverlayNotificationsExtensionMessageHandlers,
  WebsiteOriginsWithFields,
} from "./abstractions/overlay-notifications.background";
import NotificationBackground from "./notification.background";

type LoginSecurityTaskInfo = {
  securityTask: SecurityTask;
  cipher: CipherView;
  uri: ModifyLoginCipherFormData["uri"];
};

export class OverlayNotificationsBackground implements OverlayNotificationsBackgroundInterface {
  private websiteOriginsWithFields: WebsiteOriginsWithFields = new Map();
  private activeFormSubmissionRequests: ActiveFormSubmissionRequests = new Set();
  private modifyLoginCipherFormData: ModifyLoginCipherFormDataForTab = new Map();
  private clearLoginCipherFormDataSubject: Subject<void> = new Subject();
  private notificationFallbackTimeout: number | NodeJS.Timeout | null;
  private readonly formSubmissionRequestMethods: Set<string> = new Set(["POST", "PUT", "PATCH"]);
  private readonly extensionMessageHandlers: OverlayNotificationsExtensionMessageHandlers = {
    formFieldSubmitted: ({ message, sender }) => this.storeModifiedLoginFormData(message, sender),
    collectPageDetailsResponse: ({ message, sender }) =>
      this.handleCollectPageDetailsResponse(message, sender),
  };

  constructor(
    private logService: LogService,
    private notificationBackground: NotificationBackground,
    private taskService: TaskService,
    private accountService: AccountService,
    private cipherService: CipherService,
  ) {}

  /**
   * Initialize the overlay notifications background service.
   */
  async init() {
    this.setupExtensionListeners();

    this.clearLoginCipherFormDataSubject
      .pipe(switchMap(() => timer(CLEAR_NOTIFICATION_LOGIN_DATA_DURATION)))
      .subscribe(() => this.modifyLoginCipherFormData.clear());
  }

  /**
   * Handles the response from the content script with the page details. Triggers an initialization
   * of the add login or change password notification if the conditions are met.
   *
   * @param message - The message from the content script
   * @param sender - The sender of the message
   */
  private async handleCollectPageDetailsResponse(
    message: OverlayNotificationsExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (await this.shouldInitAddLoginOrChangePasswordNotification(message, sender)) {
      this.websiteOriginsWithFields.set(sender.tab.id, this.getSenderUrlMatchPatterns(sender));
      this.setupWebRequestsListeners();
    }
  }

  /**
   * Determines if the add login or change password notification should be initialized. This depends
   * on whether the user has enabled the notification, the sender is not from an excluded domain, the
   * tab's page details contains fillable fields, and the website origin has not been previously stored.
   *
   * @param message - The message from the content script
   * @param sender - The sender of the message
   */
  private async shouldInitAddLoginOrChangePasswordNotification(
    message: OverlayNotificationsExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    return (
      (await this.isAddLoginOrChangePasswordNotificationEnabled()) &&
      !(await this.isSenderFromExcludedDomain(sender)) &&
      message.details?.fields?.length > 0 &&
      !this.websiteOriginsWithFields.has(sender.tab.id)
    );
  }

  /**
   * Determines if the add login or change password notification is enabled.
   * This is based on the user's settings for the notification.
   */
  private async isAddLoginOrChangePasswordNotificationEnabled() {
    return (
      (await this.notificationBackground.getEnableChangedPasswordPrompt()) ||
      (await this.notificationBackground.getEnableAddedLoginPrompt())
    );
  }

  /**
   * Returns the match patterns for the sender's URL. This is used to filter out
   * the web requests that are not from the sender's tab.
   *
   * @param sender - The sender of the message
   */
  private getSenderUrlMatchPatterns(sender: chrome.runtime.MessageSender) {
    return new Set([
      ...generateDomainMatchPatterns(sender.url),
      ...generateDomainMatchPatterns(sender.tab.url),
    ]);
  }

  /**
   * Stores the login form data that was modified by the user in the content script. This data is
   * used to trigger the add login or change password notification when the form is submitted.
   *
   * @param message - The message from the content script
   * @param sender - The sender of the message
   */
  private storeModifiedLoginFormData = (
    message: OverlayNotificationsExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) => {
    if (!this.websiteOriginsWithFields.has(sender.tab.id)) {
      return;
    }

    const { uri, username, password, newPassword } = message;
    if (!username && !password && !newPassword) {
      return;
    }

    this.clearLoginCipherFormDataSubject.next();
    const formData = { uri, username, password, newPassword };

    const existingModifyLoginData = this.modifyLoginCipherFormData.get(sender.tab.id);
    if (existingModifyLoginData) {
      formData.username = formData.username || existingModifyLoginData.username;
      formData.password = formData.password || existingModifyLoginData.password;
      formData.newPassword = formData.newPassword || existingModifyLoginData.newPassword;
    }

    this.modifyLoginCipherFormData.set(sender.tab.id, formData);

    this.clearNotificationFallbackTimeout();
    this.notificationFallbackTimeout = setTimeout(
      () =>
        this.setupNotificationInitTrigger(
          sender.tab.id,
          "",
          this.modifyLoginCipherFormData.get(sender.tab.id),
        ).catch((error) => this.logService.error(error)),
      1500,
    );
  };

  /**
   * Clears the timeout used when triggering a notification on click of the submit button.
   */
  private clearNotificationFallbackTimeout() {
    if (this.notificationFallbackTimeout) {
      clearTimeout(this.notificationFallbackTimeout);
      this.notificationFallbackTimeout = null;
    }
  }

  /**
   * Determines if the sender of the message is from an excluded domain. This is used to prevent the
   * add login or change password notification from being triggered on the user's vault domain or
   * other excluded domains.
   *
   * @param sender - The sender of the message
   */
  private async isSenderFromExcludedDomain(sender: chrome.runtime.MessageSender): Promise<boolean> {
    try {
      const senderOrigin = sender.origin;
      const serverConfig = await this.notificationBackground.getActiveUserServerConfig();
      const activeUserVault = serverConfig?.environment?.vault;
      if (activeUserVault === senderOrigin) {
        return true;
      }

      const excludedDomains = await this.notificationBackground.getExcludedDomains();
      if (!excludedDomains) {
        return false;
      }

      const senderDomain = new URL(senderOrigin).hostname;
      return excludedDomains[senderDomain] !== undefined;
    } catch {
      return true;
    }
  }

  /**
   * Removes and resets the onBeforeRequest and onCompleted listeners for web requests. This ensures
   * that we are only listening for form submission requests on the tabs that have fillable form fields.
   */
  private setupWebRequestsListeners() {
    chrome.webRequest.onBeforeRequest.removeListener(this.handleOnBeforeRequestEvent);
    chrome.webRequest.onCompleted.removeListener(this.handleOnCompletedRequestEvent);
    if (this.websiteOriginsWithFields.size) {
      const requestFilter: chrome.webRequest.RequestFilter = this.generateRequestFilter();
      chrome.webRequest.onBeforeRequest.addListener(this.handleOnBeforeRequestEvent, requestFilter);
      chrome.webRequest.onCompleted.addListener(this.handleOnCompletedRequestEvent, requestFilter);
    }
  }

  /**
   * Generates the request filter for the web requests. This is used to filter out the web requests
   * that are not from the tabs that have fillable form fields.
   */
  private generateRequestFilter(): chrome.webRequest.RequestFilter {
    const websiteOrigins = Array.from(this.websiteOriginsWithFields.values());
    const urls: string[] = [];
    websiteOrigins.forEach((origins) => urls.push(...origins));
    return {
      urls,
      types: ["main_frame", "sub_frame", "xmlhttprequest"],
    };
  }

  /**
   * Handles the onBeforeRequest event for web requests. This is used to ensures that the following
   * onCompleted event is only triggered for form submission requests.
   *
   * @param details - The details of the web request
   */
  private handleOnBeforeRequestEvent = (details: chrome.webRequest.WebRequestDetails) => {
    if (this.isPostSubmissionFormRedirection(details)) {
      this.setupNotificationInitTrigger(
        details.tabId,
        details.requestId,
        this.modifyLoginCipherFormData.get(details.tabId),
      ).catch((error) => this.logService.error(error));

      return;
    }

    if (!this.isValidFormSubmissionRequest(details)) {
      return;
    }

    const { requestId, tabId, frameId } = details;
    this.activeFormSubmissionRequests.add(requestId);

    if (this.notificationDataIncompleteOnBeforeRequest(tabId)) {
      this.getFormFieldDataFromTab(tabId, frameId).catch((error) => this.logService.error(error));
    }
  };

  /**
   * Captures the modified login form data if the tab contains incomplete data. This is used as
   * a redundancy to ensure that the modified login form data is captured in cases where the form
   * is split into multiple parts.
   *
   * @param tabId - The id of the tab
   */
  private notificationDataIncompleteOnBeforeRequest = (tabId: number) => {
    const modifyLoginData = this.modifyLoginCipherFormData.get(tabId);
    return (
      !modifyLoginData ||
      !this.shouldAttemptAddLoginNotification(modifyLoginData) ||
      !this.shouldAttemptChangedPasswordNotification(modifyLoginData)
    );
  };

  /**
   * Determines whether the request is happening after a form submission. This is identified by a GET
   * request that is triggered after a form submission POST request from the same request id. If
   * this is the case, and the modified login form data is available, the add login or change password
   * notification is triggered.
   *
   * @param details - The details of the web request
   */
  private isPostSubmissionFormRedirection = (details: chrome.webRequest.WebRequestDetails) => {
    return (
      details.method?.toUpperCase() === "GET" &&
      this.activeFormSubmissionRequests.has(details.requestId) &&
      this.modifyLoginCipherFormData.has(details.tabId)
    );
  };

  /**
   * Determines if the web request is a valid form submission request. A valid web request
   * is a POST, PUT, or PATCH request that is not from an invalid host.
   *
   * @param details - The details of the web request
   */
  private isValidFormSubmissionRequest = (details: chrome.webRequest.WebRequestDetails) => {
    return (
      !this.requestHostIsInvalid(details) &&
      this.formSubmissionRequestMethods.has(details.method?.toUpperCase())
    );
  };

  /**
   * Retrieves the form field data from the tab. This is used to get the modified login form data
   * in cases where the submit button is not clicked, but the form is submitted through other means.
   *
   * @param tabId - The senders tab id
   * @param frameId - The frame where the form is located
   */
  private getFormFieldDataFromTab = async (tabId: number, frameId: number) => {
    const tab = await BrowserApi.getTab(tabId);
    if (!tab) {
      return;
    }

    const response = (await BrowserApi.tabSendMessage(
      tab,
      { command: "getInlineMenuFormFieldData" },
      { frameId },
    )) as OverlayNotificationsExtensionMessage;
    if (response) {
      this.storeModifiedLoginFormData(response, { tab });
    }
  };

  /**
   * Handles the onCompleted event for web requests. This is used to trigger the add login or change
   * password notification when a form submission request is completed.
   *
   * @param details - The details of the web response
   */
  private handleOnCompletedRequestEvent = async (details: chrome.webRequest.WebResponseDetails) => {
    if (
      this.requestHostIsInvalid(details) ||
      !this.activeFormSubmissionRequests.has(details.requestId)
    ) {
      return;
    }

    if (isInvalidResponseStatusCode(details.statusCode)) {
      this.clearNotificationFallbackTimeout();
      return;
    }

    const modifyLoginData = this.modifyLoginCipherFormData.get(details.tabId);
    if (!modifyLoginData) {
      return;
    }

    this.setupNotificationInitTrigger(details.tabId, details.requestId, modifyLoginData).catch(
      (error) => this.logService.error(error),
    );
  };

  /**
   * Sets up the initialization trigger for the add login or change password notification. This is used
   * to ensure that the notification is triggered after the tab has finished loading.
   *
   * @param tabId - The id of the tab
   * @param requestId - The request id of the web request
   * @param modifyLoginData - The modified login form data
   */
  private setupNotificationInitTrigger = async (
    tabId: number,
    requestId: string,
    modifyLoginData: ModifyLoginCipherFormData,
  ) => {
    this.clearNotificationFallbackTimeout();

    const tab = await BrowserApi.getTab(tabId);
    if (tab.status !== "complete") {
      await this.delayNotificationInitUntilTabIsComplete(tabId, requestId, modifyLoginData);
      return;
    }

    await this.triggerNotificationInit(requestId, modifyLoginData, tab);
  };

  /**
   * Delays the initialization of the add login or change password notification
   * until the tab is complete. This is used to ensure that the notification is
   * triggered after the tab has finished loading.
   *
   * @param tabId - The id of the tab
   * @param requestId - The request id of the web request
   * @param modifyLoginData - The modified login form data
   */
  private delayNotificationInitUntilTabIsComplete = async (
    tabId: chrome.webRequest.ResourceRequest["tabId"],
    requestId: chrome.webRequest.ResourceRequest["requestId"],
    modifyLoginData: ModifyLoginCipherFormData,
  ) => {
    const handleWebNavigationOnCompleted = async () => {
      chrome.webNavigation.onCompleted.removeListener(handleWebNavigationOnCompleted);
      const tab = await BrowserApi.getTab(tabId);
      await this.triggerNotificationInit(requestId, modifyLoginData, tab);
    };
    chrome.webNavigation.onCompleted.addListener(handleWebNavigationOnCompleted);
  };

  /**
   * Initializes the add login or change password notification based on the modified login form data
   * and the tab details. This will trigger the notification to be displayed to the user.
   *
   * @param requestId - The details of the web response
   * @param modifyLoginData  - The modified login form data
   * @param tab - The tab details
   */
  private triggerNotificationInit = async (
    requestId: chrome.webRequest.ResourceRequest["requestId"],
    modifyLoginData: ModifyLoginCipherFormData,
    tab: chrome.tabs.Tab,
  ) => {
    let result: string;
    if (this.shouldAttemptChangedPasswordNotification(modifyLoginData)) {
      // These notifications are temporarily setup as "messages" to the notification background.
      // This will be structured differently in a future refactor.
      const success = await this.notificationBackground.triggerChangedPasswordNotification(
        {
          command: "bgChangedPassword",
          data: {
            url: modifyLoginData.uri,
            currentPassword: modifyLoginData.password,
            newPassword: modifyLoginData.newPassword,
          },
        },
        { tab },
      );
      if (!success) {
        result = "Unqualified changedPassword notification attempt.";
      }
    }

    if (this.shouldAttemptAddLoginNotification(modifyLoginData)) {
      const success = await this.notificationBackground.triggerAddLoginNotification(
        {
          command: "bgTriggerAddLoginNotification",
          login: {
            url: modifyLoginData.uri,
            username: modifyLoginData.username,
            password: modifyLoginData.password || modifyLoginData.newPassword,
          },
        },
        { tab },
      );
      if (!success) {
        result = "Unqualified addLogin notification attempt.";
      }
    }

    const shouldGetTasks =
      (await this.notificationBackground.getNotificationFlag()) && !modifyLoginData.newPassword;

    if (shouldGetTasks) {
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(getOptionalUserId),
      );

      if (activeUserId) {
        const loginSecurityTaskInfo = await this.getSecurityTaskAndCipherForLoginData(
          modifyLoginData,
          activeUserId,
        );

        if (loginSecurityTaskInfo) {
          await this.notificationBackground.triggerAtRiskPasswordNotification(
            {
              command: "bgTriggerAtRiskPasswordNotification",
              data: {
                activeUserId,
                cipher: loginSecurityTaskInfo.cipher,
                securityTask: loginSecurityTaskInfo.securityTask,
              },
            },
            { tab },
          );
        } else {
          result = "Unqualified atRiskPassword notification attempt.";
        }
      }
    }
    this.clearCompletedWebRequest(requestId, tab);
    return result;
  };

  /**
   * Determines if the change password notification should be triggered.
   *
   * @param modifyLoginData - The modified login form data
   */
  private shouldAttemptChangedPasswordNotification = (
    modifyLoginData: ModifyLoginCipherFormData,
  ) => {
    return modifyLoginData?.newPassword && !modifyLoginData.username;
  };

  /**
   * Determines if the add login notification should be triggered.
   *
   * @param modifyLoginData - The modified login form data
   */
  private shouldAttemptAddLoginNotification = (modifyLoginData: ModifyLoginCipherFormData) => {
    return modifyLoginData?.username && (modifyLoginData.password || modifyLoginData.newPassword);
  };

  /**
   * If there is a security task for this cipher at login, return the task, cipher view, and uri.
   *
   * @param modifyLoginData - The modified login form data
   * @param activeUserId - The currently logged in user ID
   */
  private async getSecurityTaskAndCipherForLoginData(
    modifyLoginData: ModifyLoginCipherFormData,
    activeUserId: UserId,
  ): Promise<LoginSecurityTaskInfo | null> {
    const tasks: SecurityTask[] = await this.notificationBackground.getSecurityTasks(activeUserId);
    if (!tasks?.length) {
      return null;
    }

    const urlCiphers: CipherView[] = await this.cipherService.getAllDecryptedForUrl(
      modifyLoginData.uri,
      activeUserId,
    );
    if (!urlCiphers?.length) {
      return null;
    }

    const securityTaskForLogin = urlCiphers.reduce(
      (taskInfo: LoginSecurityTaskInfo | null, cipher: CipherView) => {
        if (
          // exit early if info was found already
          taskInfo ||
          // exit early if the cipher was deleted
          cipher.deletedDate ||
          // exit early if the entered login info doesn't match an existing cipher
          modifyLoginData.username !== cipher.login.username ||
          modifyLoginData.password !== cipher.login.password
        ) {
          return taskInfo;
        }

        // Find the first security task for the cipherId belonging to the entered login
        const cipherSecurityTask = tasks.find(
          ({ cipherId, status }) =>
            cipher.id === cipherId && // match security task cipher id to url cipher id
            status === SecurityTaskStatus.Pending, // security task has not been completed
        );

        if (cipherSecurityTask) {
          return { securityTask: cipherSecurityTask, cipher, uri: modifyLoginData.uri };
        }

        return taskInfo;
      },
      null,
    );

    return securityTaskForLogin;
  }

  /**
   * Clears the completed web request and removes the modified login form data for the tab.
   *
   * @param requestId - The request id of the web request
   * @param tab - The tab details
   */
  private clearCompletedWebRequest = (
    requestId: chrome.webRequest.ResourceRequest["requestId"],
    tab: chrome.tabs.Tab,
  ) => {
    this.activeFormSubmissionRequests.delete(requestId);
    this.modifyLoginCipherFormData.delete(tab.id);
    this.websiteOriginsWithFields.delete(tab.id);
    this.setupWebRequestsListeners();
  };

  /**
   * Determines if the host of the web request is invalid. An invalid host is any host that does not
   * start with "http" or a tab id that is less than 0.
   *
   * @param details - The details of the web request
   */
  private requestHostIsInvalid = (details: chrome.webRequest.ResourceRequest) => {
    return !details.url?.startsWith("http") || details.tabId < 0;
  };

  /**
   * Sets up the listeners for the extension messages and the tab events.
   */
  private setupExtensionListeners() {
    BrowserApi.addListener(chrome.runtime.onMessage, this.handleExtensionMessage);
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated);
  }

  /**
   * Handles messages that are sent to the extension background.
   *
   * @param message - The message from the content script
   * @param sender - The sender of the message
   * @param sendResponse - The response to send back to the content script
   */
  private handleExtensionMessage = (
    message: OverlayNotificationsExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction = this.extensionMessageHandlers[message.command];
    if (!handler) {
      return null;
    }

    const messageResponse = handler({ message, sender });
    if (typeof messageResponse === "undefined") {
      return null;
    }

    Promise.resolve(messageResponse)
      .then((response) => sendResponse(response))
      .catch((error) => this.logService.error(error));
    return true;
  };

  /**
   * Handles the removal of a tab. This is used to remove the modified login form data for the tab.
   *
   * @param tabId - The id of the tab that was removed
   */
  private handleTabRemoved = (tabId: number) => {
    this.modifyLoginCipherFormData.delete(tabId);
    if (this.websiteOriginsWithFields.has(tabId)) {
      this.websiteOriginsWithFields.delete(tabId);
      this.setupWebRequestsListeners();
    }
  };

  /**
   * Handles the update of a tab. This is used to remove the modified
   * login form  data for the tab when the tab is loading.
   *
   * @param tabId - The id of the tab that was updated
   * @param changeInfo - The change info of the tab
   */
  private handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
    if (changeInfo.status !== "loading" || !changeInfo.url) {
      return;
    }

    const originPatterns = this.websiteOriginsWithFields.get(tabId);
    if (!originPatterns) {
      return;
    }

    const matchPatters = generateDomainMatchPatterns(changeInfo.url);
    if (matchPatters.some((pattern) => originPatterns.has(pattern))) {
      return;
    }

    this.websiteOriginsWithFields.delete(tabId);
  };
}

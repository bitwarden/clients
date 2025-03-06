// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  ExtensionCommand,
  ExtensionCommandType,
  NOTIFICATION_BAR_LIFESPAN_MS,
} from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { UserNotificationSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/user-notification-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
import { openAddEditVaultItemPopout } from "../../vault/popup/utils/vault-popout-window";
import { NotificationCipherData } from "../content/components/cipher/types";
import { NotificationQueueMessageType } from "../enums/notification-queue-message-type.enum";
import { AutofillService } from "../services/abstractions/autofill.service";

import {
  AddChangePasswordQueueMessage,
  AddLoginQueueMessage,
  AddUnlockVaultQueueMessage,
  ChangePasswordMessageData,
  AddLoginMessageData,
  NotificationQueueMessageItem,
  LockedVaultPendingNotificationsData,
  NotificationBackgroundExtensionMessage,
  NotificationBackgroundExtensionMessageHandlers,
} from "./abstractions/notification.background";
import { NotificationTypeData } from "./abstractions/overlay-notifications.background";
import { OverlayBackgroundExtensionMessage } from "./abstractions/overlay.background";

export default class NotificationBackground {
  private openUnlockPopout = openUnlockPopout;
  private openAddEditVaultItemPopout = openAddEditVaultItemPopout;
  private notificationQueue: NotificationQueueMessageItem[] = [];
  private allowedRetryCommands: Set<ExtensionCommandType> = new Set([
    ExtensionCommand.AutofillLogin,
    ExtensionCommand.AutofillCard,
    ExtensionCommand.AutofillIdentity,
  ]);
  private readonly extensionMessageHandlers: NotificationBackgroundExtensionMessageHandlers = {
    unlockCompleted: ({ message, sender }) => this.handleUnlockCompleted(message, sender),
    bgGetFolderData: () => this.getFolderData(),
    bgCloseNotificationBar: ({ message, sender }) =>
      this.handleCloseNotificationBarMessage(message, sender),
    bgAdjustNotificationBar: ({ message, sender }) =>
      this.handleAdjustNotificationBarMessage(message, sender),
    bgAddLogin: ({ message, sender }) => this.addLogin(message, sender),
    bgChangedPassword: ({ message, sender }) => this.changedPassword(message, sender),
    bgRemoveTabFromNotificationQueue: ({ sender }) =>
      this.removeTabFromNotificationQueue(sender.tab),
    bgSaveCipher: ({ message, sender }) => this.handleSaveCipherMessage(message, sender),
    bgNeverSave: ({ sender }) => this.saveNever(sender.tab),
    collectPageDetailsResponse: ({ message }) =>
      this.handleCollectPageDetailsResponseMessage(message),
    bgUnlockPopoutOpened: ({ message, sender }) => this.unlockVault(message, sender.tab),
    checkNotificationQueue: ({ sender }) => this.checkNotificationQueue(sender.tab),
    bgReopenUnlockPopout: ({ sender }) => this.openUnlockPopout(sender.tab),
    bgGetEnableChangedPasswordPrompt: () => this.getEnableChangedPasswordPrompt(),
    bgGetEnableAddedLoginPrompt: () => this.getEnableAddedLoginPrompt(),
    bgGetExcludedDomains: () => this.getExcludedDomains(),
    bgGetActiveUserServerConfig: () => this.getActiveUserServerConfig(),
    getWebVaultUrlForNotification: () => this.getWebVaultUrl(),
    notificationRefreshFlagValue: () => this.getNotificationFlag(),
    bgGetDecryptedCiphers: () => this.getNotificationCipherData(),
    bgOpenVault: ({ message, sender }) => this.openVault(message, sender.tab),
  };

  constructor(
    private autofillService: AutofillService,
    private cipherService: CipherService,
    private authService: AuthService,
    private policyService: PolicyService,
    private folderService: FolderService,
    private userNotificationSettingsService: UserNotificationSettingsServiceAbstraction,
    private domainSettingsService: DomainSettingsService,
    private environmentService: EnvironmentService,
    private logService: LogService,
    private themeStateService: ThemeStateService,
    private configService: ConfigService,
    private accountService: AccountService,
  ) {}

  init() {
    if (chrome.runtime == null) {
      return;
    }

    this.setupExtensionMessageListener();

    this.cleanupNotificationQueue();
  }

  /**
   * Gets the enableChangedPasswordPrompt setting from the user notification settings service.
   */
  async getEnableChangedPasswordPrompt(): Promise<boolean> {
    return await firstValueFrom(this.userNotificationSettingsService.enableChangedPasswordPrompt$);
  }

  /**
   * Gets the enableAddedLoginPrompt setting from the user notification settings service.
   */
  async getEnableAddedLoginPrompt(): Promise<boolean> {
    return await firstValueFrom(this.userNotificationSettingsService.enableAddedLoginPrompt$);
  }

  /**
   * Gets the neverDomains setting from the domain settings service.
   */
  async getExcludedDomains(): Promise<NeverDomains> {
    return await firstValueFrom(this.domainSettingsService.neverDomains$);
  }

  /**
   *
   * Gets the current active tab and retrieves all decrypted ciphers
   * for the tab's URL. It constructs and returns an array of `NotificationCipherData` objects.
   * If no active tab or URL is found, it returns an empty array.
   *
   * @returns {Promise<NotificationCipherData[]>}
   */

  async getNotificationCipherData(): Promise<NotificationCipherData[]> {
    const [currentTab, showFavicons, env] = await Promise.all([
      BrowserApi.getTabFromCurrentWindow(),
      firstValueFrom(this.domainSettingsService.showFavicons$),
      firstValueFrom(this.environmentService.environment$),
    ]);
    const iconsServerUrl = env.getIconsUrl();
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    const decryptedCiphers = await this.cipherService.getAllDecryptedForUrl(
      currentTab.url,
      activeUserId,
    );

    return decryptedCiphers.map((view) => {
      const { id, name, reprompt, favorite, login } = view;
      return {
        id,
        name,
        type: CipherType.Login,
        reprompt,
        favorite,
        icon: buildCipherIcon(iconsServerUrl, view, showFavicons),
        login: login && {
          username: login.username,
        },
      };
    });
  }

  /**
   * Gets the active user server config from the config service.
   */
  async getActiveUserServerConfig(): Promise<ServerConfig> {
    return await firstValueFrom(this.configService.serverConfig$);
  }

  /**
   * Gets the current value of the notification refresh feature flag
   * @returns Promise<boolean> indicating if the feature is enabled
   */
  async getNotificationFlag(): Promise<boolean> {
    const flagValue = await this.configService.getFeatureFlag(FeatureFlag.NotificationRefresh);
    return flagValue;
  }

  private async getAuthStatus() {
    return await firstValueFrom(this.authService.activeAccountStatus$);
  }

  /**
   * Checks the notification queue for any messages that need to be sent to the
   * specified tab. If no tab is specified, the current tab will be used.
   *
   * @param tab - The tab to check the notification queue for
   */
  async checkNotificationQueue(tab: chrome.tabs.Tab = null): Promise<void> {
    if (this.notificationQueue.length === 0) {
      return;
    }

    if (tab != null) {
      await this.doNotificationQueueCheck(tab);
      return;
    }

    const currentTab = await BrowserApi.getTabFromCurrentWindow();
    if (currentTab != null) {
      await this.doNotificationQueueCheck(currentTab);
    }
  }

  private cleanupNotificationQueue() {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      if (this.notificationQueue[i].expires < new Date()) {
        BrowserApi.tabSendMessageData(this.notificationQueue[i].tab, "closeNotificationBar").catch(
          (error) => this.logService.error(error),
        );
        this.notificationQueue.splice(i, 1);
      }
    }
    setTimeout(() => this.cleanupNotificationQueue(), 30000); // check every 30 seconds
  }

  private async doNotificationQueueCheck(tab: chrome.tabs.Tab): Promise<void> {
    const queueMessage = this.notificationQueue.find(
      (message) => message.tab.id === tab.id && this.queueMessageIsFromTabOrigin(message, tab),
    );
    if (queueMessage) {
      await this.sendNotificationQueueMessage(tab, queueMessage);
    }
  }

  private async sendNotificationQueueMessage(
    tab: chrome.tabs.Tab,
    notificationQueueMessage: NotificationQueueMessageItem,
  ) {
    const notificationType = notificationQueueMessage.type;

    const typeData: NotificationTypeData = {
      isVaultLocked: notificationQueueMessage.wasVaultLocked,
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      launchTimestamp: notificationQueueMessage.launchTimestamp,
    };

    switch (notificationType) {
      case NotificationQueueMessageType.AddLogin:
        typeData.removeIndividualVault = await this.removeIndividualVault();
        break;
    }

    await BrowserApi.tabSendMessageData(tab, "openNotificationBar", {
      type: notificationType,
      typeData,
    });
  }

  /**
   * Removes any login messages from the notification queue that
   * are associated with the specified tab.
   *
   * @param tab - The tab to remove messages for
   */
  private removeTabFromNotificationQueue(tab: chrome.tabs.Tab) {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      if (this.notificationQueue[i].tab.id === tab.id) {
        this.notificationQueue.splice(i, 1);
      }
    }
  }

  /**
   * Adds a login message to the notification queue, prompting the user to save
   * the login if it does not already exist in the vault. If the cipher exists
   * but the password has changed, the user will be prompted to update the password.
   *
   * @param message - The message to add to the queue
   * @param sender - The contextual sender of the message
   */
  async addLogin(
    message: NotificationBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const authStatus = await this.getAuthStatus();
    if (authStatus === AuthenticationStatus.LoggedOut) {
      return;
    }

    const loginInfo = message.login;
    const normalizedUsername = loginInfo.username ? loginInfo.username.toLowerCase() : "";
    const loginDomain = Utils.getDomain(loginInfo.url);
    if (loginDomain == null) {
      return;
    }

    const addLoginIsEnabled = await this.getEnableAddedLoginPrompt();

    if (authStatus === AuthenticationStatus.Locked) {
      if (addLoginIsEnabled) {
        await this.pushAddLoginToQueue(loginDomain, loginInfo, sender.tab, true);
      }

      return;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      return;
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(loginInfo.url, activeUserId);
    const usernameMatches = ciphers.filter(
      (c) => c.login.username != null && c.login.username.toLowerCase() === normalizedUsername,
    );
    if (addLoginIsEnabled && usernameMatches.length === 0) {
      await this.pushAddLoginToQueue(loginDomain, loginInfo, sender.tab);
      return;
    }

    const changePasswordIsEnabled = await this.getEnableChangedPasswordPrompt();

    if (
      changePasswordIsEnabled &&
      usernameMatches.length === 1 &&
      usernameMatches[0].login.password !== loginInfo.password
    ) {
      await this.pushChangePasswordToQueue(
        usernameMatches[0].id,
        loginDomain,
        loginInfo.password,
        sender.tab,
      );
    }
  }

  private async pushAddLoginToQueue(
    loginDomain: string,
    loginInfo: AddLoginMessageData,
    tab: chrome.tabs.Tab,
    isVaultLocked = false,
  ) {
    // remove any old messages for this tab
    this.removeTabFromNotificationQueue(tab);
    const launchTimestamp = new Date().getTime();
    const message: AddLoginQueueMessage = {
      type: NotificationQueueMessageType.AddLogin,
      username: loginInfo.username,
      password: loginInfo.password,
      domain: loginDomain,
      uri: loginInfo.url,
      tab: tab,
      launchTimestamp,
      expires: new Date(launchTimestamp + NOTIFICATION_BAR_LIFESPAN_MS),
      wasVaultLocked: isVaultLocked,
    };
    this.notificationQueue.push(message);
    await this.checkNotificationQueue(tab);
  }

  /**
   * Adds a change password message to the notification queue, prompting the user
   * to update the password for a login that has changed.
   *
   * @param message - The message to add to the queue
   * @param sender - The contextual sender of the message
   */
  async changedPassword(
    message: NotificationBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const changeData = message.data as ChangePasswordMessageData;
    const loginDomain = Utils.getDomain(changeData.url);
    if (loginDomain == null) {
      return;
    }

    if ((await this.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      await this.pushChangePasswordToQueue(
        null,
        loginDomain,
        changeData.newPassword,
        sender.tab,
        true,
      );
      return;
    }

    let id: string = null;
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      return;
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(changeData.url, activeUserId);
    if (changeData.currentPassword != null) {
      const passwordMatches = ciphers.filter(
        (c) => c.login.password === changeData.currentPassword,
      );
      if (passwordMatches.length === 1) {
        id = passwordMatches[0].id;
      }
    } else if (ciphers.length === 1) {
      id = ciphers[0].id;
    }
    if (id != null) {
      await this.pushChangePasswordToQueue(id, loginDomain, changeData.newPassword, sender.tab);
    }
  }

  /**
   * Sends the page details to the notification bar. Will query all
   * forms with a password field and pass them to the notification bar.
   *
   * @param message - The extension message
   */
  private async handleCollectPageDetailsResponseMessage(
    message: NotificationBackgroundExtensionMessage,
  ) {
    if (message.sender !== "notificationBar") {
      return;
    }

    const forms = this.autofillService.getFormsWithPasswordFields(message.details);
    await BrowserApi.tabSendMessageData(message.tab, "notificationBarPageDetails", {
      details: message.details,
      forms: forms,
    });
  }

  /**
   * Sets up a notification to unlock the vault when the user
   * attempts to autofill a cipher while the vault is locked.
   *
   * @param message - Extension message, determines if the notification should be skipped
   * @param tab - The tab that the message was sent from
   */
  private async unlockVault(message: NotificationBackgroundExtensionMessage, tab: chrome.tabs.Tab) {
    if (message.data?.skipNotification) {
      return;
    }

    const currentAuthStatus = await this.getAuthStatus();
    if (currentAuthStatus !== AuthenticationStatus.Locked || this.notificationQueue.length) {
      return;
    }

    const loginDomain = Utils.getDomain(tab.url);
    if (loginDomain) {
      await this.pushUnlockVaultToQueue(loginDomain, tab);
    }
  }

  private async pushChangePasswordToQueue(
    cipherId: string,
    loginDomain: string,
    newPassword: string,
    tab: chrome.tabs.Tab,
    isVaultLocked = false,
  ) {
    // remove any old messages for this tab
    this.removeTabFromNotificationQueue(tab);
    const launchTimestamp = new Date().getTime();
    const message: AddChangePasswordQueueMessage = {
      type: NotificationQueueMessageType.ChangePassword,
      cipherId: cipherId,
      newPassword: newPassword,
      domain: loginDomain,
      tab: tab,
      launchTimestamp,
      expires: new Date(launchTimestamp + NOTIFICATION_BAR_LIFESPAN_MS),
      wasVaultLocked: isVaultLocked,
    };
    this.notificationQueue.push(message);
    await this.checkNotificationQueue(tab);
  }

  private async pushUnlockVaultToQueue(loginDomain: string, tab: chrome.tabs.Tab) {
    this.removeTabFromNotificationQueue(tab);
    const launchTimestamp = new Date().getTime();
    const message: AddUnlockVaultQueueMessage = {
      type: NotificationQueueMessageType.UnlockVault,
      domain: loginDomain,
      tab: tab,
      launchTimestamp,
      expires: new Date(launchTimestamp + 0.5 * 60000), // 30 seconds
      wasVaultLocked: true,
    };
    await this.sendNotificationQueueMessage(tab, message);
  }

  /**
   * Saves a cipher based on the message sent from the notification bar. If the vault
   * is locked, the message will be added to the notification queue and the unlock
   * popout will be opened.
   *
   * @param message - The extension message
   * @param sender - The contextual sender of the message
   */
  private async handleSaveCipherMessage(
    message: NotificationBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if ((await this.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      await BrowserApi.tabSendMessageData(sender.tab, "addToLockedVaultPendingNotifications", {
        commandToRetry: {
          message: {
            command: message.command,
            edit: message.edit,
            folder: message.folder,
          },
          sender: sender,
        },
        target: "notification.background",
      } as LockedVaultPendingNotificationsData);
      await this.openUnlockPopout(sender.tab);
      return;
    }

    await this.saveOrUpdateCredentials(sender.tab, message.edit, message.folder);
  }

  /**
   * Saves or updates credentials based on the message within the
   * notification queue that is associated with the specified tab.
   *
   * @param tab - The tab to save or update credentials for
   * @param edit - Identifies if the credentials should be edited or simply added
   * @param folderId - The folder to add the cipher to
   */
  private async saveOrUpdateCredentials(tab: chrome.tabs.Tab, edit: boolean, folderId?: string) {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      const queueMessage = this.notificationQueue[i];
      if (
        queueMessage.tab.id !== tab.id ||
        (queueMessage.type !== NotificationQueueMessageType.AddLogin &&
          queueMessage.type !== NotificationQueueMessageType.ChangePassword)
      ) {
        continue;
      }

      if (!this.queueMessageIsFromTabOrigin(queueMessage, tab)) {
        continue;
      }

      this.notificationQueue.splice(i, 1);

      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(getOptionalUserId),
      );

      if (queueMessage.type === NotificationQueueMessageType.ChangePassword) {
        const cipherView = await this.getDecryptedCipherById(queueMessage.cipherId, activeUserId);
        await this.updatePassword(cipherView, queueMessage.newPassword, edit, tab, activeUserId);
        return;
      }

      // If the vault was locked, check if a cipher needs updating instead of creating a new one
      if (queueMessage.wasVaultLocked) {
        const allCiphers = await this.cipherService.getAllDecryptedForUrl(
          queueMessage.uri,
          activeUserId,
        );
        const existingCipher = allCiphers.find(
          (c) =>
            c.login.username != null && c.login.username.toLowerCase() === queueMessage.username,
        );

        if (existingCipher != null) {
          await this.updatePassword(existingCipher, queueMessage.password, edit, tab, activeUserId);
          return;
        }
      }

      folderId = (await this.folderExists(folderId, activeUserId)) ? folderId : null;
      const newCipher = this.convertAddLoginQueueMessageToCipherView(queueMessage, folderId);

      if (edit) {
        await this.editItem(newCipher, activeUserId, tab);
        await BrowserApi.tabSendMessage(tab, { command: "closeNotificationBar" });
        return;
      }

      const cipher = await this.cipherService.encrypt(newCipher, activeUserId);
      try {
        await this.cipherService.createWithServer(cipher);
        await BrowserApi.tabSendMessageData(tab, "saveCipherAttemptCompleted", {
          username: String(queueMessage?.username),
          cipherId: String(cipher?.id),
        });
        await BrowserApi.tabSendMessage(tab, { command: "addedCipher" });
      } catch (error) {
        await BrowserApi.tabSendMessageData(tab, "saveCipherAttemptCompleted", {
          error: String(error.message),
        });
      }
    }
  }

  /**
   * Handles updating an existing cipher's password. If the cipher
   * is being edited, a popup will be opened to allow the user to
   * edit the cipher.
   *
   * @param cipherView - The cipher to update
   * @param newPassword - The new password to update the cipher with
   * @param edit - Identifies if the cipher should be edited or simply updated
   * @param tab - The tab that the message was sent from
   * @param userId - The active account user ID
   */
  private async updatePassword(
    cipherView: CipherView,
    newPassword: string,
    edit: boolean,
    tab: chrome.tabs.Tab,
    userId: UserId,
  ) {
    cipherView.login.password = newPassword;

    if (edit) {
      await this.editItem(cipherView, userId, tab);
      await BrowserApi.tabSendMessage(tab, { command: "closeNotificationBar" });
      await BrowserApi.tabSendMessage(tab, { command: "editedCipher" });
      return;
    }
    const cipher = await this.cipherService.encrypt(cipherView, userId);
    try {
      await this.cipherService.updateWithServer(cipher);
      await BrowserApi.tabSendMessageData(tab, "saveCipherAttemptCompleted", {
        username: String(cipherView?.login?.username),
        cipherId: String(cipherView?.id),
      });
    } catch (error) {
      await BrowserApi.tabSendMessageData(tab, "saveCipherAttemptCompleted", {
        error: String(error?.message),
      });
    }
  }

  /**
   * Sets the add/edit cipher info in the cipher service
   * and opens the add/edit vault item popout.
   *
   * @param cipherView - The cipher to edit
   * @param userId - The active account user ID
   * @param senderTab - The tab that the message was sent from
   */
  private async editItem(cipherView: CipherView, userId: UserId, senderTab: chrome.tabs.Tab) {
    await this.cipherService.setAddEditCipherInfo(
      {
        cipher: cipherView,
        collectionIds: cipherView.collectionIds,
      },
      userId,
    );

    await this.openAddEditVaultItemPopout(senderTab, { cipherId: cipherView.id });
  }

  private async openVault(
    message: NotificationBackgroundExtensionMessage,
    senderTab: chrome.tabs.Tab,
  ) {
    if (!message.cipherId) {
      await this.openAddEditVaultItemPopout(senderTab);
    }
    await this.openAddEditVaultItemPopout(senderTab, { cipherId: message.cipherId });
  }

  private async folderExists(folderId: string, userId: UserId) {
    if (Utils.isNullOrWhitespace(folderId) || folderId === "null") {
      return false;
    }
    const folders = await firstValueFrom(this.folderService.folderViews$(userId));
    return folders.some((x) => x.id === folderId);
  }

  private async getDecryptedCipherById(cipherId: string, userId: UserId) {
    const cipher = await this.cipherService.get(cipherId, userId);
    if (cipher != null && cipher.type === CipherType.Login) {
      return await cipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(cipher, userId),
      );
    }
    return null;
  }

  /**
   * Saves the current tab's domain to the never save list.
   *
   * @param tab - The tab that sent the neverSave message
   */
  private async saveNever(tab: chrome.tabs.Tab) {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      const queueMessage = this.notificationQueue[i];
      if (
        queueMessage.tab.id !== tab.id ||
        queueMessage.type !== NotificationQueueMessageType.AddLogin
      ) {
        continue;
      }

      if (!this.queueMessageIsFromTabOrigin(queueMessage, tab)) {
        continue;
      }

      this.notificationQueue.splice(i, 1);
      await BrowserApi.tabSendMessageData(tab, "closeNotificationBar");

      const hostname = Utils.getHostname(tab.url);
      await this.cipherService.saveNeverDomain(hostname);
    }
  }

  /**
   * Returns the first value found from the folder service's folderViews$ observable.
   */
  private async getFolderData() {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    return await firstValueFrom(this.folderService.folderViews$(activeUserId));
  }

  private async getWebVaultUrl(): Promise<string> {
    const env = await firstValueFrom(this.environmentService.environment$);
    return env.getWebVaultUrl();
  }

  private async removeIndividualVault(): Promise<boolean> {
    return await firstValueFrom(
      this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership),
    );
  }

  /**
   * Handles the unlockCompleted extension message. Will close the notification bar
   * after an attempted autofill action, and retry the autofill action if the message
   * contains a follow-up command.
   *
   * @param message - The extension message
   * @param sender - The contextual sender of the message
   */
  private async handleUnlockCompleted(
    message: NotificationBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ): Promise<void> {
    const messageData = message.data as LockedVaultPendingNotificationsData;
    const retryCommand = messageData.commandToRetry.message.command as ExtensionCommandType;
    if (this.allowedRetryCommands.has(retryCommand)) {
      await BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
    }

    if (messageData.target !== "notification.background") {
      return;
    }

    const retryHandler: CallableFunction | undefined = this.extensionMessageHandlers[retryCommand];
    if (retryHandler) {
      retryHandler({
        message: messageData.commandToRetry.message,
        sender: messageData.commandToRetry.sender,
      });
    }
  }

  /**
   * Sends a message back to the sender tab which
   * triggers closure of the notification bar.
   *
   * @param message - The extension message
   * @param sender - The contextual sender of the message
   */
  private async handleCloseNotificationBarMessage(
    message: NotificationBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    await BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar", {
      fadeOutNotification: !!message.fadeOutNotification,
    });
  }

  /**
   * Sends a message back to the sender tab which triggers
   * an CSS adjustment of the notification bar.
   *
   * @param message - The extension message
   * @param sender - The contextual sender of the message
   */
  private async handleAdjustNotificationBarMessage(
    message: NotificationBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    await BrowserApi.tabSendMessageData(sender.tab, "adjustNotificationBar", message.data);
  }

  /**
   * Accepts a login queue message and converts it into a
   * login uri view, login view, and cipher view.
   *
   * @param message - The message to convert to a cipher view
   * @param folderId - The folder to add the cipher to
   */
  private convertAddLoginQueueMessageToCipherView(
    message: AddLoginQueueMessage,
    folderId?: string,
  ): CipherView {
    const uriView = new LoginUriView();
    uriView.uri = message.uri;

    const loginView = new LoginView();
    loginView.uris = [uriView];
    loginView.username = message.username;
    loginView.password = message.password;

    const cipherView = new CipherView();
    cipherView.name = (Utils.getHostname(message.uri) || message.domain).replace(/^www\./, "");
    cipherView.folderId = folderId;
    cipherView.type = CipherType.Login;
    cipherView.login = loginView;

    return cipherView;
  }

  private setupExtensionMessageListener() {
    BrowserApi.messageListener("notification.background", this.handleExtensionMessage);
  }

  private handleExtensionMessage = (
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[message?.command];
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
   * Validates whether the queue message is associated with the passed tab.
   *
   * @param queueMessage - The queue message to check
   * @param tab - The tab to check the queue message against
   */
  private queueMessageIsFromTabOrigin(
    queueMessage: NotificationQueueMessageItem,
    tab: chrome.tabs.Tab,
  ) {
    const tabDomain = Utils.getDomain(tab.url);
    return tabDomain === queueMessage.domain || tabDomain === Utils.getDomain(queueMessage.tab.url);
  }
}

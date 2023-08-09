import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ThemeType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import AddUnlockVaultQueueMessage from "../../background/models/add-unlock-vault-queue-message";
import AddChangePasswordQueueMessage from "../../background/models/addChangePasswordQueueMessage";
import AddLoginQueueMessage from "../../background/models/addLoginQueueMessage";
import AddLoginRuntimeMessage from "../../background/models/addLoginRuntimeMessage";
import ChangePasswordRuntimeMessage from "../../background/models/changePasswordRuntimeMessage";
import LockedVaultPendingNotificationsItem from "../../background/models/lockedVaultPendingNotificationsItem";
import { NotificationQueueMessageType } from "../../background/models/notificationQueueMessageType";
import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserStateService } from "../../platform/services/abstractions/browser-state.service";
import { AutofillService } from "../services/abstractions/autofill.service";

export default class NotificationBackground {
  private notificationQueue: (
    | AddLoginQueueMessage
    | AddChangePasswordQueueMessage
    | AddUnlockVaultQueueMessage
  )[] = [];

  constructor(
    private autofillService: AutofillService,
    private cipherService: CipherService,
    private authService: AuthService,
    private policyService: PolicyService,
    private folderService: FolderService,
    private stateService: BrowserStateService,
    private environmentService: EnvironmentService
  ) {}

  async init() {
    if (chrome.runtime == null) {
      return;
    }

    BrowserApi.messageListener(
      "notification.background",
      async (msg: any, sender: chrome.runtime.MessageSender) => {
        await this.processMessage(msg, sender);
      }
    );

    this.cleanupNotificationQueue();
  }

  async processMessage(msg: any, sender: chrome.runtime.MessageSender) {
    switch (msg.command) {
      case "unlockCompleted":
        await this.handleUnlockCompleted(msg.data, sender);
        break;
      case "bgGetDataForTab":
        await this.getDataForTab(sender.tab, msg.responseCommand);
        break;
      case "bgCloseNotificationBar":
        await BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
        break;
      case "bgAdjustNotificationBar":
        await BrowserApi.tabSendMessageData(sender.tab, "adjustNotificationBar", msg.data);
        break;
      case "bgAddLogin":
        await this.addLogin(msg.login, sender.tab);
        break;
      case "bgChangedPassword":
        await this.changedPassword(msg.data, sender.tab);
        break;
      case "bgAddClose":
      case "bgChangeClose":
        this.removeTabFromNotificationQueue(sender.tab);
        break;
      case "bgAddSave":
      case "bgChangeSave":
        if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
          const retryMessage: LockedVaultPendingNotificationsItem = {
            commandToRetry: {
              msg: {
                command: msg,
              },
              sender: sender,
            },
            target: "notification.background",
          };
          await BrowserApi.tabSendMessageData(
            sender.tab,
            "addToLockedVaultPendingNotifications",
            retryMessage
          );
          await BrowserApi.tabSendMessageData(sender.tab, "promptForLogin");
          return;
        }
        await this.saveOrUpdateCredentials(sender.tab, msg.edit, msg.folder);
        break;
      case "bgNeverSave":
        await this.saveNever(sender.tab);
        break;
      case "collectPageDetailsResponse":
        switch (msg.sender) {
          case "notificationBar": {
            const forms = this.autofillService.getFormsWithPasswordFields(msg.details);
            await BrowserApi.tabSendMessageData(msg.tab, "notificationBarPageDetails", {
              details: msg.details,
              forms: forms,
            });
            break;
          }
          default:
            break;
        }
        break;
      case "promptForLogin":
        await this.unlockVault(sender.tab);
        break;
      default:
        break;
    }
  }

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
        this.notificationQueue.splice(i, 1);
      }
    }
    setTimeout(() => this.cleanupNotificationQueue(), 2 * 60 * 1000); // check every 2 minutes
  }

  private async doNotificationQueueCheck(tab: chrome.tabs.Tab): Promise<void> {
    if (tab == null) {
      return;
    }

    const tabDomain = Utils.getDomain(tab.url);
    if (tabDomain == null) {
      return;
    }

    for (let i = 0; i < this.notificationQueue.length; i++) {
      if (
        this.notificationQueue[i].tabId !== tab.id ||
        this.notificationQueue[i].domain !== tabDomain
      ) {
        continue;
      }

      if (this.notificationQueue[i].type === NotificationQueueMessageType.AddLogin) {
        BrowserApi.tabSendMessageData(tab, "openNotificationBar", {
          type: "add",
          typeData: {
            isVaultLocked: this.notificationQueue[i].wasVaultLocked,
            theme: await this.getCurrentTheme(),
            removeIndividualVault: await this.removeIndividualVault(),
            webVaultURL: await this.environmentService.getWebVaultUrl(),
          },
        });
      } else if (this.notificationQueue[i].type === NotificationQueueMessageType.ChangePassword) {
        BrowserApi.tabSendMessageData(tab, "openNotificationBar", {
          type: "change",
          typeData: {
            isVaultLocked: this.notificationQueue[i].wasVaultLocked,
            theme: await this.getCurrentTheme(),
            webVaultURL: await this.environmentService.getWebVaultUrl(),
          },
        });
      } else if (this.notificationQueue[i].type === NotificationQueueMessageType.UnlockVault) {
        BrowserApi.tabSendMessageData(tab, "openNotificationBar", {
          type: "unlock",
          typeData: {
            isVaultLocked: this.notificationQueue[i].wasVaultLocked,
            theme: await this.getCurrentTheme(),
          },
        });
      }
      break;
    }
  }

  private async getCurrentTheme() {
    const theme = await this.stateService.getTheme();

    if (theme !== ThemeType.System) {
      return theme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? ThemeType.Dark
      : ThemeType.Light;
  }

  private removeTabFromNotificationQueue(tab: chrome.tabs.Tab) {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      if (this.notificationQueue[i].tabId === tab.id) {
        this.notificationQueue.splice(i, 1);
      }
    }
  }

  private async addLogin(loginInfo: AddLoginRuntimeMessage, tab: chrome.tabs.Tab) {
    const authStatus = await this.authService.getAuthStatus();
    if (authStatus === AuthenticationStatus.LoggedOut) {
      return;
    }

    const loginDomain = Utils.getDomain(loginInfo.url);
    if (loginDomain == null) {
      return;
    }

    let normalizedUsername = loginInfo.username;
    if (normalizedUsername != null) {
      normalizedUsername = normalizedUsername.toLowerCase();
    }

    const disabledAddLogin = await this.stateService.getDisableAddLoginNotification();
    if (authStatus === AuthenticationStatus.Locked) {
      if (disabledAddLogin) {
        return;
      }

      this.pushAddLoginToQueue(loginDomain, loginInfo, tab, true);
      return;
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(loginInfo.url);
    const usernameMatches = ciphers.filter(
      (c) => c.login.username != null && c.login.username.toLowerCase() === normalizedUsername
    );
    if (usernameMatches.length === 0) {
      if (disabledAddLogin) {
        return;
      }

      this.pushAddLoginToQueue(loginDomain, loginInfo, tab);
    } else if (
      usernameMatches.length === 1 &&
      usernameMatches[0].login.password !== loginInfo.password
    ) {
      const disabledChangePassword =
        await this.stateService.getDisableChangedPasswordNotification();
      if (disabledChangePassword) {
        return;
      }
      this.pushChangePasswordToQueue(usernameMatches[0].id, loginDomain, loginInfo.password, tab);
    }
  }

  private async pushAddLoginToQueue(
    loginDomain: string,
    loginInfo: AddLoginRuntimeMessage,
    tab: chrome.tabs.Tab,
    isVaultLocked = false
  ) {
    // remove any old messages for this tab
    this.removeTabFromNotificationQueue(tab);
    const message: AddLoginQueueMessage = {
      type: NotificationQueueMessageType.AddLogin,
      username: loginInfo.username,
      password: loginInfo.password,
      domain: loginDomain,
      uri: loginInfo.url,
      tabId: tab.id,
      expires: new Date(new Date().getTime() + 5 * 60000), // 5 minutes
      wasVaultLocked: isVaultLocked,
    };
    this.notificationQueue.push(message);
    await this.checkNotificationQueue(tab);
  }

  private async changedPassword(changeData: ChangePasswordRuntimeMessage, tab: chrome.tabs.Tab) {
    const loginDomain = Utils.getDomain(changeData.url);
    if (loginDomain == null) {
      return;
    }

    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      this.pushChangePasswordToQueue(null, loginDomain, changeData.newPassword, tab, true);
      return;
    }

    let id: string = null;
    const ciphers = await this.cipherService.getAllDecryptedForUrl(changeData.url);
    if (changeData.currentPassword != null) {
      const passwordMatches = ciphers.filter(
        (c) => c.login.password === changeData.currentPassword
      );
      if (passwordMatches.length === 1) {
        id = passwordMatches[0].id;
      }
    } else if (ciphers.length === 1) {
      id = ciphers[0].id;
    }
    if (id != null) {
      this.pushChangePasswordToQueue(id, loginDomain, changeData.newPassword, tab);
    }
  }

  private async unlockVault(tab: chrome.tabs.Tab) {
    const currentAuthStatus = await this.authService.getAuthStatus();
    if (currentAuthStatus !== AuthenticationStatus.Locked || this.notificationQueue.length) {
      return;
    }

    const loginDomain = Utils.getDomain(tab.url);
    if (!loginDomain) {
      return;
    }

    this.pushUnlockVaultToQueue(loginDomain, tab);
  }

  private async pushChangePasswordToQueue(
    cipherId: string,
    loginDomain: string,
    newPassword: string,
    tab: chrome.tabs.Tab,
    isVaultLocked = false
  ) {
    // remove any old messages for this tab
    this.removeTabFromNotificationQueue(tab);
    const message: AddChangePasswordQueueMessage = {
      type: NotificationQueueMessageType.ChangePassword,
      cipherId: cipherId,
      newPassword: newPassword,
      domain: loginDomain,
      tabId: tab.id,
      expires: new Date(new Date().getTime() + 5 * 60000), // 5 minutes
      wasVaultLocked: isVaultLocked,
    };
    this.notificationQueue.push(message);
    await this.checkNotificationQueue(tab);
  }

  private async pushUnlockVaultToQueue(loginDomain: string, tab: chrome.tabs.Tab) {
    this.removeTabFromNotificationQueue(tab);
    const message: AddUnlockVaultQueueMessage = {
      type: NotificationQueueMessageType.UnlockVault,
      domain: loginDomain,
      tabId: tab.id,
      expires: new Date(new Date().getTime() + 0.5 * 60000), // 30 seconds
      wasVaultLocked: true,
    };
    this.notificationQueue.push(message);
    await this.checkNotificationQueue(tab);
    this.removeTabFromNotificationQueue(tab);
  }

  private async saveOrUpdateCredentials(tab: chrome.tabs.Tab, edit: boolean, folderId?: string) {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      const queueMessage = this.notificationQueue[i];
      if (queueMessage.tabId !== tab.id || !(queueMessage.type in NotificationQueueMessageType)) {
        continue;
      }

      const tabDomain = Utils.getDomain(tab.url);
      if (tabDomain != null && tabDomain !== queueMessage.domain) {
        continue;
      }

      this.notificationQueue.splice(i, 1);
      BrowserApi.tabSendMessageData(tab, "closeNotificationBar");

      if (queueMessage.type === NotificationQueueMessageType.ChangePassword) {
        const cipherView = await this.getDecryptedCipherById(queueMessage.cipherId);
        await this.updatePassword(cipherView, queueMessage.newPassword, edit, tab);
        return;
      }

      if (queueMessage.type === NotificationQueueMessageType.AddLogin) {
        // If the vault was locked, check if a cipher needs updating instead of creating a new one
        if (queueMessage.wasVaultLocked) {
          const allCiphers = await this.cipherService.getAllDecryptedForUrl(queueMessage.uri);
          const existingCipher = allCiphers.find(
            (c) =>
              c.login.username != null && c.login.username.toLowerCase() === queueMessage.username
          );

          if (existingCipher != null) {
            await this.updatePassword(existingCipher, queueMessage.password, edit, tab);
            return;
          }
        }

        folderId = (await this.folderExists(folderId)) ? folderId : null;
        const newCipher = AddLoginQueueMessage.toCipherView(queueMessage, folderId);

        if (edit) {
          await this.editItem(newCipher, tab);
          return;
        }

        const cipher = await this.cipherService.encrypt(newCipher);
        await this.cipherService.createWithServer(cipher);
        BrowserApi.tabSendMessageData(tab, "addedCipher");
      }
    }
  }

  private async updatePassword(
    cipherView: CipherView,
    newPassword: string,
    edit: boolean,
    tab: chrome.tabs.Tab
  ) {
    cipherView.login.password = newPassword;

    if (edit) {
      await this.editItem(cipherView, tab);
      BrowserApi.tabSendMessage(tab, "editedCipher");
      return;
    }

    const cipher = await this.cipherService.encrypt(cipherView);
    await this.cipherService.updateWithServer(cipher);
    // We've only updated the password, no need to broadcast editedCipher message
    return;
  }

  private async editItem(cipherView: CipherView, senderTab: chrome.tabs.Tab) {
    await this.stateService.setAddEditCipherInfo({
      cipher: cipherView,
      collectionIds: cipherView.collectionIds,
    });

    await BrowserApi.tabSendMessageData(senderTab, "openAddEditCipher", {
      cipherId: cipherView.id,
    });
  }

  private async folderExists(folderId: string) {
    if (Utils.isNullOrWhitespace(folderId) || folderId === "null") {
      return false;
    }

    const folders = await firstValueFrom(this.folderService.folderViews$);
    return folders.some((x) => x.id === folderId);
  }

  private async getDecryptedCipherById(cipherId: string) {
    const cipher = await this.cipherService.get(cipherId);
    if (cipher != null && cipher.type === CipherType.Login) {
      return await cipher.decrypt();
    }
    return null;
  }

  private async saveNever(tab: chrome.tabs.Tab) {
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      const queueMessage = this.notificationQueue[i];
      if (
        queueMessage.tabId !== tab.id ||
        queueMessage.type !== NotificationQueueMessageType.AddLogin
      ) {
        continue;
      }

      const tabDomain = Utils.getDomain(tab.url);
      if (tabDomain != null && tabDomain !== queueMessage.domain) {
        continue;
      }

      this.notificationQueue.splice(i, 1);
      BrowserApi.tabSendMessageData(tab, "closeNotificationBar");

      const hostname = Utils.getHostname(tab.url);
      await this.cipherService.saveNeverDomain(hostname);
    }
  }

  private async getDataForTab(tab: chrome.tabs.Tab, responseCommand: string) {
    const responseData: any = {};
    if (responseCommand === "notificationBarGetFoldersList") {
      responseData.folders = await firstValueFrom(this.folderService.folderViews$);
    }

    await BrowserApi.tabSendMessageData(tab, responseCommand, responseData);
  }

  private async removeIndividualVault(): Promise<boolean> {
    return await firstValueFrom(
      this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
    );
  }

  private async handleUnlockCompleted(
    messageData: LockedVaultPendingNotificationsItem,
    sender: chrome.runtime.MessageSender
  ): Promise<void> {
    if (messageData.commandToRetry.msg.command === "autofill_login") {
      await BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
    }

    if (messageData.target !== "notification.background") {
      return;
    }

    await this.processMessage(
      messageData.commandToRetry.msg.command,
      messageData.commandToRetry.sender
    );
  }
}

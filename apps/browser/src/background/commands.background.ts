import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

import { BrowserApi } from "../platform/browser/browser-api";

import MainBackground from "./main.background";
import LockedVaultPendingNotificationsItem from "./models/lockedVaultPendingNotificationsItem";

export default class CommandsBackground {
  private isSafari: boolean;
  private isVivaldi: boolean;

  constructor(
    private main: MainBackground,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutService: VaultTimeoutService,
    private authService: AuthService
  ) {
    this.isSafari = this.platformUtilsService.isSafari();
    this.isVivaldi = this.platformUtilsService.isVivaldi();
  }

  async init() {
    BrowserApi.messageListener(
      "commands.background",
      async (msg: any, sender: chrome.runtime.MessageSender, sendResponse: any) => {
        if (msg.command === "unlockCompleted" && msg.data.target === "commands.background") {
          await this.processCommand(
            msg.data.commandToRetry.msg.command,
            msg.data.commandToRetry.sender
          );
        }
      }
    );

    if (chrome && chrome.commands) {
      chrome.commands.onCommand.addListener(async (command: string) => {
        await this.processCommand(command);
      });
    }
  }

  private async processCommand(command: string, sender?: chrome.runtime.MessageSender) {
    switch (command) {
      case "generate_password":
        await this.generatePasswordToClipboard();
        break;
      case "autofill_login":
        await this.autoFillLogin(sender ? sender.tab : null);
        break;
      case "open_popup":
        await this.openPopup();
        break;
      case "lock_vault":
        await this.vaultTimeoutService.lock();
        break;
      default:
        break;
    }
  }

  private async generatePasswordToClipboard() {
    const options = (await this.passwordGenerationService.getOptions())?.[0] ?? {};
    const password = await this.passwordGenerationService.generatePassword(options);
    this.platformUtilsService.copyToClipboard(password, { window: window });
    this.passwordGenerationService.addHistory(password);
  }

  private async autoFillLogin(tab?: chrome.tabs.Tab) {
    if (!tab) {
      tab = await BrowserApi.getTabFromCurrentWindowId();
    }

    if (tab == null) {
      return;
    }

    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      const retryMessage: LockedVaultPendingNotificationsItem = {
        commandToRetry: {
          msg: { command: "autofill_login" },
          sender: { tab: tab },
        },
        target: "commands.background",
      };
      await BrowserApi.tabSendMessageData(
        tab,
        "addToLockedVaultPendingNotifications",
        retryMessage
      );

      BrowserApi.tabSendMessageData(tab, "promptForLogin");
      return;
    }

    await this.main.collectPageDetailsForContentScript(tab, "autofill_cmd");
  }

  private async openPopup() {
    // Chrome APIs cannot open popup
    if (!this.isSafari) {
      return;
    }

    this.main.openPopup();
  }
}

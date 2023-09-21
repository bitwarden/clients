import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EventType } from "@bitwarden/common/enums";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  authServiceFactory,
  AuthServiceInitOptions,
} from "../../auth/background/service-factories/auth-service.factory";
import { totpServiceFactory } from "../../auth/background/service-factories/totp-service.factory";
import { userVerificationServiceFactory } from "../../auth/background/service-factories/user-verification-service.factory";
import LockedVaultPendingNotificationsItem from "../../background/models/lockedVaultPendingNotificationsItem";
import { eventCollectionServiceFactory } from "../../background/service-factories/event-collection-service.factory";
import { Account } from "../../models/account";
import { CachedServices } from "../../platform/background/service-factories/factory-options";
import { stateServiceFactory } from "../../platform/background/service-factories/state-service.factory";
import { BrowserApi } from "../../platform/browser/browser-api";
import { passwordGenerationServiceFactory } from "../../tools/background/service_factories/password-generation-service.factory";
import {
  cipherServiceFactory,
  CipherServiceInitOptions,
} from "../../vault/background/service_factories/cipher-service.factory";
import { autofillServiceFactory } from "../background/service_factories/autofill-service.factory";
import { copyToClipboard, GeneratePasswordToClipboardCommand } from "../clipboard";
import { AutofillTabCommand } from "../commands/autofill-tab-command";

import {
  AUTOFILL_ID,
  COPY_IDENTIFIER_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATIONCODE_ID,
  GENERATE_PASSWORD_ID,
  NOOP_COMMAND_SUFFIX,
} from "./main-context-menu-handler";

export type CopyToClipboardOptions = { text: string; tab: chrome.tabs.Tab };
export type CopyToClipboardAction = (options: CopyToClipboardOptions) => void;
export type AutofillAction = (tab: chrome.tabs.Tab, cipher: CipherView) => Promise<void>;

export type GeneratePasswordToClipboardAction = (tab: chrome.tabs.Tab) => Promise<void>;

const NOT_IMPLEMENTED = (..._args: unknown[]) =>
  Promise.reject<never>("This action is not implemented inside of a service worker context.");

export class ContextMenuClickedHandler {
  constructor(
    private copyToClipboard: CopyToClipboardAction,
    private generatePasswordToClipboard: GeneratePasswordToClipboardAction,
    private autofillAction: AutofillAction,
    private authService: AuthService,
    private cipherService: CipherService,
    private totpService: TotpService,
    private eventCollectionService: EventCollectionService,
    private userVerificationService: UserVerificationService
  ) {}

  static async mv3Create(cachedServices: CachedServices) {
    const stateFactory = new StateFactory(GlobalState, Account);
    const serviceOptions: AuthServiceInitOptions & CipherServiceInitOptions = {
      apiServiceOptions: {
        logoutCallback: NOT_IMPLEMENTED,
      },
      cryptoFunctionServiceOptions: {
        win: self,
      },
      encryptServiceOptions: {
        logMacFailures: false,
      },
      i18nServiceOptions: {
        systemLanguage: chrome.i18n.getUILanguage(),
      },
      keyConnectorServiceOptions: {
        logoutCallback: NOT_IMPLEMENTED,
      },
      logServiceOptions: {
        isDev: false,
      },
      platformUtilsServiceOptions: {
        biometricCallback: NOT_IMPLEMENTED,
        clipboardWriteCallback: NOT_IMPLEMENTED,
        win: self,
      },
      stateServiceOptions: {
        stateFactory: stateFactory,
      },
    };

    const generatePasswordToClipboardCommand = new GeneratePasswordToClipboardCommand(
      await passwordGenerationServiceFactory(cachedServices, serviceOptions),
      await stateServiceFactory(cachedServices, serviceOptions)
    );

    const autofillCommand = new AutofillTabCommand(
      await autofillServiceFactory(cachedServices, serviceOptions)
    );

    return new ContextMenuClickedHandler(
      (options) => copyToClipboard(options.tab, options.text),
      (tab) => generatePasswordToClipboardCommand.generatePasswordToClipboard(tab),
      (tab, cipher) => autofillCommand.doAutofillTabWithCipherCommand(tab, cipher),
      await authServiceFactory(cachedServices, serviceOptions),
      await cipherServiceFactory(cachedServices, serviceOptions),
      await totpServiceFactory(cachedServices, serviceOptions),
      await eventCollectionServiceFactory(cachedServices, serviceOptions),
      await userVerificationServiceFactory(cachedServices, serviceOptions)
    );
  }

  static async onClickedListener(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab,
    cachedServices: CachedServices = {}
  ) {
    const contextMenuClickedHandler = await ContextMenuClickedHandler.mv3Create(cachedServices);
    await contextMenuClickedHandler.run(info, tab);
  }

  static async messageListener(
    message: { command: string; data: LockedVaultPendingNotificationsItem },
    sender: chrome.runtime.MessageSender,
    cachedServices: CachedServices
  ) {
    if (
      message.command !== "unlockCompleted" ||
      message.data.target !== "contextmenus.background"
    ) {
      return;
    }

    const contextMenuClickedHandler = await ContextMenuClickedHandler.mv3Create(cachedServices);
    await contextMenuClickedHandler.run(
      message.data.commandToRetry.msg.data,
      message.data.commandToRetry.sender.tab
    );
  }

  async run(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
    switch (info.menuItemId) {
      case GENERATE_PASSWORD_ID:
        if (!tab) {
          return;
        }
        await this.generatePasswordToClipboard(tab);
        break;
      case COPY_IDENTIFIER_ID:
        if (!tab) {
          return;
        }
        this.copyToClipboard({ text: await this.getIdentifier(tab, info), tab: tab });
        break;
      default:
        await this.cipherAction(info, tab);
    }
  }

  async cipherAction(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      const retryMessage: LockedVaultPendingNotificationsItem = {
        commandToRetry: {
          msg: { command: NOOP_COMMAND_SUFFIX, data: info },
          sender: { tab: tab },
        },
        target: "contextmenus.background",
      };
      await BrowserApi.tabSendMessageData(
        tab,
        "addToLockedVaultPendingNotifications",
        retryMessage
      );

      await BrowserApi.tabSendMessageData(tab, "promptForLogin");
      return;
    }

    // NOTE: We don't actually use the first part of this ID, we further switch based on the parentMenuItemId
    // I would really love to not add it but that is a departure from how it currently works.
    const id = (info.menuItemId as string).split("_")[1]; // We create all the ids, we can guarantee they are strings
    let cipher: CipherView | undefined;
    if (id === NOOP_COMMAND_SUFFIX) {
      // This NOOP item has come through which is generally only for no access state but since we got here
      // we are actually unlocked we will do our best to find a good match of an item to autofill this is useful
      // in scenarios like unlock on autofill
      const ciphers = await this.cipherService.getAllDecryptedForUrl(tab.url);
      cipher = ciphers[0];
    } else {
      const ciphers = await this.cipherService.getAllDecrypted();
      cipher = ciphers.find((c) => c.id === id);
    }

    if (cipher == null) {
      return;
    }

    switch (info.parentMenuItemId) {
      case AUTOFILL_ID:
        if (tab == null) {
          return;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await BrowserApi.tabSendMessageData(tab, "passwordReprompt", {
            cipherId: cipher.id,
            action: AUTOFILL_ID,
          });
        } else {
          await this.autofillAction(tab, cipher);
        }

        break;
      case COPY_USERNAME_ID:
        this.copyToClipboard({ text: cipher.login.username, tab: tab });
        break;
      case COPY_PASSWORD_ID:
        if (await this.isPasswordRepromptRequired(cipher)) {
          await BrowserApi.tabSendMessageData(tab, "passwordReprompt", {
            cipherId: cipher.id,
            action: COPY_PASSWORD_ID,
          });
        } else {
          this.copyToClipboard({ text: cipher.login.password, tab: tab });
          this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
        }

        break;
      case COPY_VERIFICATIONCODE_ID:
        if (await this.isPasswordRepromptRequired(cipher)) {
          await BrowserApi.tabSendMessageData(tab, "passwordReprompt", {
            cipherId: cipher.id,
            action: COPY_VERIFICATIONCODE_ID,
          });
        } else {
          this.copyToClipboard({
            text: await this.totpService.getCode(cipher.login.totp),
            tab: tab,
          });
        }

        break;
    }
  }

  private async isPasswordRepromptRequired(cipher: CipherView): Promise<boolean> {
    return (
      cipher.reprompt === CipherRepromptType.Password &&
      (await this.userVerificationService.hasMasterPasswordAndMasterKeyHash())
    );
  }

  private async getIdentifier(tab: chrome.tabs.Tab, info: chrome.contextMenus.OnClickData) {
    return new Promise<string>((resolve, reject) => {
      BrowserApi.sendTabsMessage(
        tab.id,
        { command: "getClickedElement" },
        { frameId: info.frameId },
        (identifier: string) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          resolve(identifier);
        }
      );
    });
  }
}

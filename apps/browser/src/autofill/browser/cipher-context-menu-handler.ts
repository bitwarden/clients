import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  authServiceFactory,
  AuthServiceInitOptions,
} from "../../auth/background/service-factories/auth-service.factory";
import { Account } from "../../models/account";
import { CachedServices } from "../../platform/background/service-factories/factory-options";
import { BrowserApi } from "../../platform/browser/browser-api";
import {
  cipherServiceFactory,
  CipherServiceInitOptions,
} from "../../vault/background/service_factories/cipher-service.factory";
import { AutofillCipherTypeId } from "../types";

import { MainContextMenuHandler } from "./main-context-menu-handler";

const NOT_IMPLEMENTED = (..._args: unknown[]) => Promise.resolve();

const LISTENED_TO_COMMANDS = [
  "loggedIn",
  "unlocked",
  "syncCompleted",
  "bgUpdateContextMenu",
  "editedCipher",
  "addedCipher",
  "deletedCipher",
];

export class CipherContextMenuHandler {
  constructor(
    private mainContextMenuHandler: MainContextMenuHandler,
    private authService: AuthService,
    private cipherService: CipherService,
  ) {}

  static async create(cachedServices: CachedServices) {
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
        biometricCallback: () => Promise.resolve(false),
        clipboardWriteCallback: NOT_IMPLEMENTED,
        win: self,
      },
      stateServiceOptions: {
        stateFactory: stateFactory,
      },
    };
    return new CipherContextMenuHandler(
      await MainContextMenuHandler.mv3Create(cachedServices),
      await authServiceFactory(cachedServices, serviceOptions),
      await cipherServiceFactory(cachedServices, serviceOptions),
    );
  }

  static async windowsOnFocusChangedListener(windowId: number, serviceCache: CachedServices) {
    const cipherContextMenuHandler = await CipherContextMenuHandler.create(serviceCache);
    const tab = await BrowserApi.getTabFromCurrentWindow();
    await cipherContextMenuHandler.update(tab?.url);
  }

  static async tabsOnActivatedListener(
    activeInfo: chrome.tabs.TabActiveInfo,
    serviceCache: CachedServices,
  ) {
    const cipherContextMenuHandler = await CipherContextMenuHandler.create(serviceCache);
    const tab = await BrowserApi.getTab(activeInfo.tabId);
    await cipherContextMenuHandler.update(tab.url);
  }

  static async tabsOnReplacedListener(
    addedTabId: number,
    removedTabId: number,
    serviceCache: CachedServices,
  ) {
    const cipherContextMenuHandler = await CipherContextMenuHandler.create(serviceCache);
    const tab = await BrowserApi.getTab(addedTabId);
    await cipherContextMenuHandler.update(tab.url);
  }

  static async tabsOnUpdatedListener(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
    serviceCache: CachedServices,
  ) {
    if (changeInfo.status !== "complete") {
      return;
    }
    const cipherContextMenuHandler = await CipherContextMenuHandler.create(serviceCache);
    await cipherContextMenuHandler.update(tab.url);
  }

  static async messageListener(
    message: { command: string },
    sender: chrome.runtime.MessageSender,
    cachedServices: CachedServices,
  ) {
    if (!CipherContextMenuHandler.shouldListen(message)) {
      return;
    }
    const cipherContextMenuHandler = await CipherContextMenuHandler.create(cachedServices);
    await cipherContextMenuHandler.messageListener(message);
  }

  private static shouldListen(message: { command: string }) {
    return LISTENED_TO_COMMANDS.includes(message.command);
  }

  async messageListener(message: { command: string }, sender?: chrome.runtime.MessageSender) {
    if (!CipherContextMenuHandler.shouldListen(message)) {
      return;
    }

    const activeTabs = await BrowserApi.getActiveTabs();
    if (!activeTabs || activeTabs.length === 0) {
      return;
    }

    await this.update(activeTabs[0].url);
  }

  async update(url: string) {
    if (this.mainContextMenuHandler.initRunning) {
      return;
    }

    const authStatus = await this.authService.getAuthStatus();
    await MainContextMenuHandler.removeAll();
    if (authStatus !== AuthenticationStatus.Unlocked) {
      // Should I pass in the auth status or even have two separate methods for this
      // on MainContextMenuHandler
      await this.mainContextMenuHandler.noAccess();
      return;
    }

    const menuEnabled = await this.mainContextMenuHandler.init();
    if (!menuEnabled) {
      return;
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(url, [
      CipherType.Card,
      CipherType.Identity,
    ]);
    ciphers.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));

    const groupedCiphers: Record<AutofillCipherTypeId, CipherView[]> = ciphers.reduce(
      (ciphersByType, cipher) => {
        if (!cipher?.type) {
          return ciphersByType;
        }

        const existingCiphersOfType = ciphersByType[cipher.type as AutofillCipherTypeId] || [];

        return {
          ...ciphersByType,
          [cipher.type]: [...existingCiphersOfType, cipher],
        };
      },
      {
        [CipherType.Login]: [],
        [CipherType.Card]: [],
        [CipherType.Identity]: [],
      },
    );

    if (groupedCiphers[CipherType.Login].length === 0) {
      await this.mainContextMenuHandler.noLogins();
    }

    if (groupedCiphers[CipherType.Identity].length === 0) {
      await this.mainContextMenuHandler.noIdentities();
    }

    if (groupedCiphers[CipherType.Card].length === 0) {
      await this.mainContextMenuHandler.noCards();
    }

    for (const cipher of ciphers) {
      await this.updateForCipher(cipher);
    }
  }

  private async updateForCipher(cipher: CipherView) {
    if (
      cipher == null ||
      !new Set([CipherType.Login, CipherType.Card, CipherType.Identity]).has(cipher.type)
    ) {
      return;
    }

    let title = cipher.name;

    if (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(title) && cipher.login?.username) {
      title += ` (${cipher.login.username})`;
    }

    if (cipher.type === CipherType.Card && cipher.card?.subTitle) {
      title += ` ${cipher.card.subTitle}`;
    }

    await this.mainContextMenuHandler.loadOptions(title, cipher.id, cipher);
  }
}

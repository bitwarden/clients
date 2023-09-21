import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { Account } from "../../models/account";
import { CachedServices } from "../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../platform/background/service-factories/i18n-service.factory";
import {
  logServiceFactory,
  LogServiceInitOptions,
} from "../../platform/background/service-factories/log-service.factory";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../platform/background/service-factories/state-service.factory";
import { BrowserStateService } from "../../platform/services/abstractions/browser-state.service";

export const ROOT_ID = "root";

export const AUTOFILL_ID = "autofill";
export const COPY_USERNAME_ID = "copy-username";
export const COPY_PASSWORD_ID = "copy-password";
export const COPY_VERIFICATIONCODE_ID = "copy-totp";
export const COPY_IDENTIFIER_ID = "copy-identifier";

const SEPARATOR_ID = "separator";
export const GENERATE_PASSWORD_ID = "generate-password";

export const NOOP_COMMAND_SUFFIX = "noop";

export class MainContextMenuHandler {
  //
  private initRunning = false;

  create: (options: chrome.contextMenus.CreateProperties) => Promise<void>;

  constructor(
    private stateService: BrowserStateService,
    private i18nService: I18nService,
    private logService: LogService
  ) {
    if (chrome.contextMenus) {
      this.create = (options) => {
        return new Promise<void>((resolve, reject) => {
          chrome.contextMenus.create(options, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve();
          });
        });
      };
    } else {
      this.create = (_options) => Promise.resolve();
    }
  }

  static async mv3Create(cachedServices: CachedServices) {
    const stateFactory = new StateFactory(GlobalState, Account);
    const serviceOptions: StateServiceInitOptions & I18nServiceInitOptions & LogServiceInitOptions =
      {
        cryptoFunctionServiceOptions: {
          win: self,
        },
        encryptServiceOptions: {
          logMacFailures: false,
        },
        i18nServiceOptions: {
          systemLanguage: chrome.i18n.getUILanguage(),
        },
        logServiceOptions: {
          isDev: false,
        },
        stateServiceOptions: {
          stateFactory: stateFactory,
        },
      };

    return new MainContextMenuHandler(
      await stateServiceFactory(cachedServices, serviceOptions),
      await i18nServiceFactory(cachedServices, serviceOptions),
      await logServiceFactory(cachedServices, serviceOptions)
    );
  }

  /**
   *
   * @returns a boolean showing whether or not items were created
   */
  async init(): Promise<boolean> {
    const menuDisabled = await this.stateService.getDisableContextMenuItem();
    if (menuDisabled) {
      await MainContextMenuHandler.removeAll();
      return false;
    }

    if (this.initRunning) {
      return true;
    }
    this.initRunning = true;

    try {
      const create = async (options: Omit<chrome.contextMenus.CreateProperties, "contexts">) => {
        await this.create({ ...options, contexts: ["all"] });
      };

      await create({
        id: ROOT_ID,
        title: "Bitwarden",
      });

      await create({
        id: AUTOFILL_ID,
        parentId: ROOT_ID,
        title: this.i18nService.t("autoFill"),
      });

      await create({
        id: COPY_USERNAME_ID,
        parentId: ROOT_ID,
        title: this.i18nService.t("copyUsername"),
      });

      await create({
        id: COPY_PASSWORD_ID,
        parentId: ROOT_ID,
        title: this.i18nService.t("copyPassword"),
      });

      if (await this.stateService.getCanAccessPremium()) {
        await create({
          id: COPY_VERIFICATIONCODE_ID,
          parentId: ROOT_ID,
          title: this.i18nService.t("copyVerificationCode"),
        });
      }

      await create({
        id: SEPARATOR_ID,
        type: "separator",
        parentId: ROOT_ID,
      });

      await create({
        id: GENERATE_PASSWORD_ID,
        parentId: ROOT_ID,
        title: this.i18nService.t("generatePasswordCopied"),
      });

      await create({
        id: COPY_IDENTIFIER_ID,
        parentId: ROOT_ID,
        title: this.i18nService.t("copyElementIdentifier"),
      });
    } catch (error) {
      this.logService.warning(error.message);
    } finally {
      this.initRunning = false;
    }
    return true;
  }

  static async removeAll() {
    return new Promise<void>((resolve, reject) => {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });
    });
  }

  static remove(menuItemId: string) {
    return new Promise<void>((resolve, reject) => {
      chrome.contextMenus.remove(menuItemId, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });
    });
  }

  async loadOptions(title: string, id: string, url: string, cipher?: CipherView | undefined) {
    if (cipher != null && cipher.type !== CipherType.Login) {
      return;
    }

    try {
      const sanitizedTitle = MainContextMenuHandler.sanitizeContextMenuTitle(title);

      const createChildItem = async (parent: string) => {
        const menuItemId = `${parent}_${id}`;
        return await this.create({
          type: "normal",
          id: menuItemId,
          parentId: parent,
          title: sanitizedTitle,
          contexts: ["all"],
        });
      };

      if (cipher == null || !Utils.isNullOrEmpty(cipher.login.password)) {
        await createChildItem(AUTOFILL_ID);
        if (cipher?.viewPassword ?? true) {
          await createChildItem(COPY_PASSWORD_ID);
        }
      }

      if (cipher == null || !Utils.isNullOrEmpty(cipher.login.username)) {
        await createChildItem(COPY_USERNAME_ID);
      }

      const canAccessPremium = await this.stateService.getCanAccessPremium();
      if (canAccessPremium && (cipher == null || !Utils.isNullOrEmpty(cipher.login.totp))) {
        await createChildItem(COPY_VERIFICATIONCODE_ID);
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  static sanitizeContextMenuTitle(title: string): string {
    return title.replace(/&/g, "&&");
  }

  async noAccess() {
    if (await this.init()) {
      const authed = await this.stateService.getIsAuthenticated();
      await this.loadOptions(
        this.i18nService.t(authed ? "unlockVaultMenu" : "loginToVaultMenu"),
        NOOP_COMMAND_SUFFIX,
        "<all_urls>"
      );
    }
  }

  async noLogins(url: string) {
    await this.loadOptions(this.i18nService.t("noMatchingLogins"), NOOP_COMMAND_SUFFIX, url);
  }
}

import { firstValueFrom } from "rxjs";

import {
  AUTOFILL_CARD_ID,
  AUTOFILL_ID,
  AUTOFILL_IDENTITY_ID,
  COPY_IDENTIFIER_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  CREATE_CARD_ID,
  CREATE_IDENTITY_ID,
  CREATE_LOGIN_ID,
  GENERATE_PASSWORD_ID,
  NOOP_COMMAND_SUFFIX,
  ROOT_ID,
  SEPARATOR_ID,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { autofillSettingsServiceFactory } from "../../autofill/background/service_factories/autofill-settings-service.factory";
import { Account } from "../../models/account";
import { billingAccountProfileStateServiceFactory } from "../../platform/background/service-factories/billing-account-profile-state-service.factory";
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

import { InitContextMenuItems } from "./abstractions/main-context-menu-handler";

export class MainContextMenuHandler {
  initRunning = false;
  private initContextMenuItems: InitContextMenuItems[] = [
    {
      id: ROOT_ID,
      title: "Bitwarden",
    },
    {
      id: AUTOFILL_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("autoFillLogin"),
    },
    {
      id: COPY_USERNAME_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyUsername"),
    },
    {
      id: COPY_PASSWORD_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyPassword"),
    },
    {
      id: COPY_VERIFICATION_CODE_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyVerificationCode"),
      checkPremiumAccess: true,
    },
    {
      id: SEPARATOR_ID + 1,
      type: "separator",
      parentId: ROOT_ID,
    },
    {
      id: AUTOFILL_IDENTITY_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("autoFillIdentity"),
    },
    {
      id: AUTOFILL_CARD_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("autoFillCard"),
    },
    {
      id: SEPARATOR_ID + 2,
      type: "separator",
      parentId: ROOT_ID,
    },
    {
      id: GENERATE_PASSWORD_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("generatePasswordCopied"),
    },
    {
      id: COPY_IDENTIFIER_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyElementIdentifier"),
    },
  ];
  private noCardsContextMenuItems: chrome.contextMenus.CreateProperties[] = [
    {
      id: `${AUTOFILL_CARD_ID}_NOTICE`,
      enabled: false,
      parentId: AUTOFILL_CARD_ID,
      title: this.i18nService.t("noCards"),
      type: "normal",
    },
    {
      id: `${AUTOFILL_CARD_ID}_${SEPARATOR_ID}`,
      parentId: AUTOFILL_CARD_ID,
      type: "separator",
    },
    {
      id: `${AUTOFILL_CARD_ID}_${CREATE_CARD_ID}`,
      parentId: AUTOFILL_CARD_ID,
      title: this.i18nService.t("addCardMenu"),
      type: "normal",
    },
  ];
  private noIdentitiesContextMenuItems: chrome.contextMenus.CreateProperties[] = [
    {
      id: `${AUTOFILL_IDENTITY_ID}_NOTICE`,
      enabled: false,
      parentId: AUTOFILL_IDENTITY_ID,
      title: this.i18nService.t("noIdentities"),
      type: "normal",
    },
    {
      id: `${AUTOFILL_IDENTITY_ID}_${SEPARATOR_ID}`,
      parentId: AUTOFILL_IDENTITY_ID,
      type: "separator",
    },
    {
      id: `${AUTOFILL_IDENTITY_ID}_${CREATE_IDENTITY_ID}`,
      parentId: AUTOFILL_IDENTITY_ID,
      title: this.i18nService.t("addIdentityMenu"),
      type: "normal",
    },
  ];
  private noLoginsContextMenuItems: chrome.contextMenus.CreateProperties[] = [
    {
      id: `${AUTOFILL_ID}_NOTICE`,
      enabled: false,
      parentId: AUTOFILL_ID,
      title: this.i18nService.t("noMatchingLogins"),
      type: "normal",
    },
    {
      id: `${AUTOFILL_ID}_${SEPARATOR_ID}1`,
      parentId: AUTOFILL_ID,
      type: "separator",
    },
  ];

  constructor(
    private stateService: BrowserStateService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private i18nService: I18nService,
    private logService: LogService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

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
        platformUtilsServiceOptions: {
          clipboardWriteCallback: () => Promise.resolve(),
          biometricCallback: () => Promise.resolve(false),
          win: self,
        },
      };

    return new MainContextMenuHandler(
      await stateServiceFactory(cachedServices, serviceOptions),
      await autofillSettingsServiceFactory(cachedServices, serviceOptions),
      await i18nServiceFactory(cachedServices, serviceOptions),
      await logServiceFactory(cachedServices, serviceOptions),
      await billingAccountProfileStateServiceFactory(cachedServices, serviceOptions),
    );
  }

  /**
   *
   * @returns a boolean showing whether or not items were created
   */
  async init(): Promise<boolean> {
    const menuEnabled = await firstValueFrom(this.autofillSettingsService.enableContextMenu$);
    if (!menuEnabled) {
      await MainContextMenuHandler.removeAll();
      return false;
    }

    if (this.initRunning) {
      return true;
    }
    this.initRunning = true;

    try {
      for (const options of this.initContextMenuItems) {
        if (
          options.checkPremiumAccess &&
          !(await firstValueFrom(this.billingAccountProfileStateService.hasPremiumFromAnySource$))
        ) {
          continue;
        }

        delete options.checkPremiumAccess;
        await MainContextMenuHandler.create({ ...options, contexts: ["all"] });
      }
    } catch (error) {
      this.logService.warning(error.message);
    } finally {
      this.initRunning = false;
    }
    return true;
  }

  /**
   * Creates a context menu item
   *
   * @param options - the options for the context menu item
   */
  private static create = async (options: chrome.contextMenus.CreateProperties) => {
    if (!chrome.contextMenus) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      chrome.contextMenus.create(options, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });
    });
  };

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

  async loadOptions(title: string, optionId: string, cipher?: CipherView) {
    try {
      const sanitizedTitle = MainContextMenuHandler.sanitizeContextMenuTitle(title);

      const createChildItem = async (parentId: string) => {
        const menuItemId = `${parentId}_${optionId}`;

        return await MainContextMenuHandler.create({
          type: "normal",
          id: menuItemId,
          parentId,
          title: sanitizedTitle,
          contexts: ["all"],
        });
      };

      if (
        !cipher ||
        (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(cipher.login?.password))
      ) {
        await createChildItem(AUTOFILL_ID);

        if (cipher?.viewPassword ?? true) {
          await createChildItem(COPY_PASSWORD_ID);
        }
      }

      if (
        !cipher ||
        (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(cipher.login?.username))
      ) {
        await createChildItem(COPY_USERNAME_ID);
      }

      const canAccessPremium = await firstValueFrom(
        this.billingAccountProfileStateService.hasPremiumFromAnySource$,
      );
      if (canAccessPremium && (!cipher || !Utils.isNullOrEmpty(cipher.login?.totp))) {
        await createChildItem(COPY_VERIFICATION_CODE_ID);
      }

      if ((!cipher || cipher.type === CipherType.Card) && optionId !== CREATE_LOGIN_ID) {
        await createChildItem(AUTOFILL_CARD_ID);
      }

      if ((!cipher || cipher.type === CipherType.Identity) && optionId !== CREATE_LOGIN_ID) {
        await createChildItem(AUTOFILL_IDENTITY_ID);
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
      this.loadOptions(
        this.i18nService.t(authed ? "unlockVaultMenu" : "loginToVaultMenu"),
        NOOP_COMMAND_SUFFIX,
      ).catch((error) => this.logService.warning(error.message));
    }
  }

  async noCards() {
    try {
      for (const option of this.noCardsContextMenuItems) {
        await MainContextMenuHandler.create(option);
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  async noIdentities() {
    try {
      for (const option of this.noIdentitiesContextMenuItems) {
        await MainContextMenuHandler.create(option);
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  async noLogins() {
    try {
      for (const option of this.noLoginsContextMenuItems) {
        await MainContextMenuHandler.create(option);
      }

      await this.loadOptions(this.i18nService.t("addLoginMenu"), CREATE_LOGIN_ID);
    } catch (error) {
      this.logService.warning(error.message);
    }
  }
}

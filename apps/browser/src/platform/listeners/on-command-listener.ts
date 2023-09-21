import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";

import { authServiceFactory } from "../../auth/background/service-factories/auth-service.factory";
import { autofillServiceFactory } from "../../autofill/background/service_factories/autofill-service.factory";
import { GeneratePasswordToClipboardCommand } from "../../autofill/clipboard";
import { AutofillTabCommand } from "../../autofill/commands/autofill-tab-command";
import { Account } from "../../models/account";
import { stateServiceFactory } from "../../platform/background/service-factories/state-service.factory";
import {
  passwordGenerationServiceFactory,
  PasswordGenerationServiceInitOptions,
} from "../../tools/background/service_factories/password-generation-service.factory";
import { CachedServices } from "../background/service-factories/factory-options";
import { logServiceFactory } from "../background/service-factories/log-service.factory";
import { BrowserApi } from "../browser/browser-api";

export const onCommandListener = async (command: string, tab: chrome.tabs.Tab) => {
  switch (command) {
    case "autofill_login":
      await doAutoFillLogin(tab);
      break;
    case "generate_password":
      await doGeneratePasswordToClipboard(tab);
      break;
  }
};

const doAutoFillLogin = async (tab: chrome.tabs.Tab): Promise<void> => {
  const cachedServices: CachedServices = {};
  const opts = {
    cryptoFunctionServiceOptions: {
      win: self,
    },
    encryptServiceOptions: {
      logMacFailures: true,
    },
    logServiceOptions: {
      isDev: false,
    },
    platformUtilsServiceOptions: {
      clipboardWriteCallback: () => Promise.resolve(),
      biometricCallback: () => Promise.resolve(false),
      win: self,
    },
    stateServiceOptions: {
      stateFactory: new StateFactory(GlobalState, Account),
    },
    apiServiceOptions: {
      logoutCallback: () => Promise.resolve(),
    },
    keyConnectorServiceOptions: {
      logoutCallback: () => Promise.resolve(),
    },
    i18nServiceOptions: {
      systemLanguage: BrowserApi.getUILanguage(self),
    },
  };
  const logService = await logServiceFactory(cachedServices, opts);
  const authService = await authServiceFactory(cachedServices, opts);
  const autofillService = await autofillServiceFactory(cachedServices, opts);

  const authStatus = await authService.getAuthStatus();
  if (authStatus < AuthenticationStatus.Unlocked) {
    // TODO: Add back in unlock on autofill
    logService.info("Currently not unlocked, MV3 does not support unlock on autofill currently.");
    return;
  }

  const command = new AutofillTabCommand(autofillService);
  await command.doAutofillTabCommand(tab);
};

const doGeneratePasswordToClipboard = async (tab: chrome.tabs.Tab): Promise<void> => {
  const stateFactory = new StateFactory(GlobalState, Account);

  const cache = {};
  const options: PasswordGenerationServiceInitOptions = {
    cryptoFunctionServiceOptions: {
      win: self,
    },
    encryptServiceOptions: {
      logMacFailures: false,
    },
    logServiceOptions: {
      isDev: false,
    },
    platformUtilsServiceOptions: {
      biometricCallback: () => Promise.resolve(true),
      clipboardWriteCallback: () => Promise.resolve(),
      win: self,
    },
    stateServiceOptions: {
      stateFactory: stateFactory,
    },
  };

  const command = new GeneratePasswordToClipboardCommand(
    await passwordGenerationServiceFactory(cache, options),
    await stateServiceFactory(cache, options)
  );
  command.generatePasswordToClipboard(tab);
};

import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";

import { Account } from "../../models/account";
import {
  EnvironmentServiceInitOptions,
  environmentServiceFactory,
} from "../background/service-factories/environment-service.factory";
import { BrowserApi } from "../browser/browser-api";

export async function onInstallListener(details: chrome.runtime.InstalledDetails) {
  const cache = {};
  const opts: EnvironmentServiceInitOptions = {
    encryptServiceOptions: {
      logMacFailures: false,
    },
    cryptoFunctionServiceOptions: {
      win: self,
    },
    logServiceOptions: {
      isDev: false,
    },
    stateServiceOptions: {
      stateFactory: new StateFactory(GlobalState, Account),
    },
  };
  const environmentService = await environmentServiceFactory(cache, opts);

  setTimeout(async () => {
    if (details.reason != null && details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      BrowserApi.createNewTab("https://bitwarden.com/browser-start/");

      if (await environmentService.hasManagedEnvironment()) {
        await environmentService.setUrlsToManagedEnvironment();
      }
    }
  }, 100);
}

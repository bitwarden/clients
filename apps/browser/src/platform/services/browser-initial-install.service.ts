import { Observable, map } from "rxjs";

import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import {
  GlobalState,
  EXTENSION_INITIAL_INSTALL_DISK,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";
import { ExtensionInstallType } from "../browser/extension-install-type";

const WELCOME_PAGE_URL = "https://bitwarden.com/browser-start/";

const EXTENSION_INSTALLED = new KeyDefinition<boolean>(
  EXTENSION_INITIAL_INSTALL_DISK,
  "extensionInstalled",
  {
    deserializer: (obj) => obj,
  },
);

export default class BrowserInitialInstallService {
  private extensionInstalled: GlobalState<boolean> =
    this.stateProvider.getGlobal(EXTENSION_INSTALLED);

  readonly extensionInstalled$: Observable<boolean> = this.extensionInstalled.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  async setExtensionInstalled(value: boolean) {
    await this.extensionInstalled.update(() => value);
  }

  /**
   * Display the configured welcome page on initial install, if the
   * install type supports it.
   */
  async displayWelcomePage() {
    // We use the install type here because it is available at install time, versus
    // specific MDM-delivered settings, which are eventually consistent on extension load.
    const installType = await BrowserApi.getInstallType();

    // We only want to show the welcome page if the extension is initiated by the user
    // and not if it's installed administratively.
    // We also enable it for Unknown install types, to handle browsers
    // that don't expose the install type for us.
    const isUserInitiatedInstall =
      installType === ExtensionInstallType.Normal || installType === ExtensionInstallType.Unknown;

    if (isUserInitiatedInstall || devFlagEnabled("enableWelcomeOnInstall")) {
      void BrowserApi.createNewTab(WELCOME_PAGE_URL);
    }
  }
}

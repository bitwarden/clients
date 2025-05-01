// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import MainBackground from "../../background/main.background";
import IconDetails from "../../vault/background/models/icon-details";
import { BrowserApi } from "../browser/browser-api";
import { BrowserPlatformUtilsService } from "../services/platform-utils/browser-platform-utils.service";

export type BadgeOptions = {
  tab?: chrome.tabs.Tab;
  windowId?: number;
};

export class UpdateBadge {
  private authService: AuthService;
  private badgeSettingsService: BadgeSettingsServiceAbstraction;
  private cipherService: CipherService;
  private accountService: AccountService;
  private badgeAction: typeof chrome.action | typeof chrome.browserAction;
  private sidebarAction: OperaSidebarAction | FirefoxSidebarAction;
  private win: Window & typeof globalThis;

  constructor(win: Window & typeof globalThis, services: MainBackground) {
    this.badgeAction = BrowserApi.getBrowserAction();
    this.sidebarAction = BrowserApi.getSidebarAction(self);
    this.win = win;

    this.badgeSettingsService = services.badgeSettingsService;
    this.authService = services.authService;
    this.cipherService = services.cipherService;
    this.accountService = services.accountService;
  }

  async run(opts?: { tabId?: number; windowId?: number }): Promise<void> {
    const authStatus = await this.authService.getAuthStatus();

    await this.setBadgeBackgroundColor();

    switch (authStatus) {
      case AuthenticationStatus.LoggedOut: {
        await this.setLoggedOut();
        break;
      }
      case AuthenticationStatus.Locked: {
        await this.setLocked();
        break;
      }
      case AuthenticationStatus.Unlocked: {
        const tab = await this.getTab(opts?.tabId, opts?.windowId);
        await this.setUnlocked({ tab, windowId: tab?.windowId });
        break;
      }
    }
  }

  async setLoggedOut(): Promise<void> {
    await this.setBadgeIcon("_gray");
    await this.clearBadgeText();
  }

  async setLocked() {
    await this.setBadgeIcon("_locked");
    await this.clearBadgeText();
  }

  private async clearBadgeText() {
    const tabs = await BrowserApi.getActiveTabs();
    if (tabs != null) {
      tabs.forEach(async (tab) => {
        if (tab.id != null) {
          await this.setBadgeText("", tab.id);
        }
      });
    }
  }

  async setUnlocked(opts: BadgeOptions) {
    await this.setBadgeIcon("");

    const enableBadgeCounter = await firstValueFrom(this.badgeSettingsService.enableBadgeCounter$);
    if (!enableBadgeCounter) {
      return;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (!activeUserId) {
      return;
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(opts?.tab?.url, activeUserId);
    let countText = ciphers.length == 0 ? "" : ciphers.length.toString();
    if (ciphers.length > 9) {
      countText = "9+";
    }
    await this.setBadgeText(countText, opts?.tab?.id);
  }

  setBadgeBackgroundColor(color = "#294e5f") {
    if (this.badgeAction?.setBadgeBackgroundColor) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.badgeAction.setBadgeBackgroundColor({ color });
    }
    if (this.isOperaSidebar(this.sidebarAction)) {
      this.sidebarAction.setBadgeBackgroundColor({ color });
    }
  }

  setBadgeText(text: string, tabId?: number) {
    this.setActionText(text, tabId);
    this.setSideBarText(text, tabId);
  }

  async setBadgeIcon(iconSuffix: string, windowId?: number) {
    const options: IconDetails = {
      path: {
        19: "/images/icon19" + iconSuffix + ".png",
        38: "/images/icon38" + iconSuffix + ".png",
      },
    };
    if (windowId && BrowserPlatformUtilsService.isFirefox()) {
      options.windowId = windowId;
    }

    await this.setActionIcon(options);
    await this.setSidebarActionIcon(options);
  }

  private setActionText(text: string, tabId?: number) {
    if (this.badgeAction?.setBadgeText) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.badgeAction.setBadgeText({ text, tabId });
    }
  }

  private setSideBarText(text: string, tabId?: number) {
    if (this.isOperaSidebar(this.sidebarAction)) {
      this.sidebarAction.setBadgeText({ text, tabId });
    } else if (this.sidebarAction) {
      // Firefox
      const title = `Bitwarden${Utils.isNullOrEmpty(text) ? "" : ` [${text}]`}`;
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.sidebarAction.setTitle({ title, tabId });
    }
  }

  private async setActionIcon(options: IconDetails) {
    if (!this.badgeAction?.setIcon) {
      return;
    }

    if (this.useSyncApiCalls) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.badgeAction.setIcon(options);
    } else {
      await new Promise<void>((resolve) => this.badgeAction.setIcon(options, () => resolve()));
    }
  }

  private async setSidebarActionIcon(options: IconDetails) {
    if (!this.sidebarAction?.setIcon) {
      return;
    }

    if ("opr" in this.win && BrowserApi.isManifestVersion(3)) {
      // setIcon API is currenly broken for Opera MV3 extensions
      // https://forums.opera.com/topic/75680/opr-sidebaraction-seticon-api-is-broken-access-to-extension-api-denied?_=1738349261570
      // The API currently crashes on MacOS
      return;
    }

    if (this.isOperaSidebar(this.sidebarAction)) {
      await new Promise<void>((resolve) =>
        (this.sidebarAction as OperaSidebarAction).setIcon(options, () => resolve()),
      );
    } else {
      await this.sidebarAction.setIcon(options);
    }
  }

  private async getTab(tabId?: number, windowId?: number) {
    return (
      (await BrowserApi.getTab(tabId)) ??
      (windowId
        ? await BrowserApi.tabsQueryFirst({ active: true, windowId })
        : await BrowserApi.tabsQueryFirst({ active: true, currentWindow: true })) ??
      (await BrowserApi.tabsQueryFirst({ active: true, lastFocusedWindow: true })) ??
      (await BrowserApi.tabsQueryFirst({ active: true }))
    );
  }

  private get useSyncApiCalls() {
    return (
      BrowserPlatformUtilsService.isFirefox() || BrowserPlatformUtilsService.isSafari(this.win)
    );
  }

  private isOperaSidebar(
    action: OperaSidebarAction | FirefoxSidebarAction,
  ): action is OperaSidebarAction {
    return action != null && (action as OperaSidebarAction).setBadgeText != null;
  }
}

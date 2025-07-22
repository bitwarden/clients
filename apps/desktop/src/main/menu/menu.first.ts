import { BrowserWindow, dialog, MenuItem, MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherType } from "@bitwarden/sdk-internal";

import { isMacAppStore, isSnapStore, isWindowsStore } from "../../utils";
import { UpdaterMain } from "../updater.main";

import { MenuAccount } from "./menu.updater";

export class FirstMenu {
  constructor(
    protected readonly _i18nService: I18nService,
    protected readonly _messagingService: MessagingService,
    protected readonly _updater: UpdaterMain,
    protected readonly _window: BrowserWindow,
    protected readonly _accounts: { [userId: string]: MenuAccount },
    protected readonly _isLocked: boolean,
    protected readonly _isLockable: boolean,
    protected readonly _restrictedCipherTypes: CipherType[],
  ) {}

  protected get hasAccounts(): boolean {
    return this._accounts != null && Object.keys(this._accounts).length > 0;
  }

  protected get hasLockableAccounts(): boolean {
    return this._accounts != null && Object.values(this._accounts).some((a) => a.isLockable);
  }

  protected get hasAuthenticatedAccounts(): boolean {
    return this._accounts != null && Object.values(this._accounts).some((a) => a.isAuthenticated);
  }

  protected get checkForUpdates(): MenuItemConstructorOptions {
    return {
      id: "checkForUpdates",
      label: this.localize("checkForUpdates"),
      click: (menuItem) => this.checkForUpdate(menuItem),
      visible: !isMacAppStore() && !isWindowsStore() && !isSnapStore(),
    };
  }

  protected get separator(): MenuItemConstructorOptions {
    return {
      type: "separator",
    };
  }

  protected get settings(): MenuItemConstructorOptions {
    return {
      id: "settings",
      label: this.localize(process.platform === "darwin" ? "preferences" : "settings"),
      click: () => this.sendMessage("openSettings"),
      accelerator: "CmdOrCtrl+,",
      enabled: !this._isLocked,
    };
  }

  protected get lock(): MenuItemConstructorOptions {
    return {
      id: "lock",
      label: this.localize("lockVault"),
      submenu: this.lockSubmenu,
      enabled: this.hasLockableAccounts,
    };
  }

  protected get lockSubmenu(): MenuItemConstructorOptions[] {
    const value: MenuItemConstructorOptions[] = [];
    for (const userId in this._accounts) {
      if (!userId) {
        continue;
      }

      const account = this._accounts[userId];

      if (account == null || !account.isLockable) {
        continue;
      }

      value.push({
        label: account.email,
        id: `lockNow_${account.userId}`,
        click: () => this.sendMessage("lockVault", { userId: account.userId }),
        enabled: !account.isLocked,
        visible: account.isAuthenticated,
      });
    }
    return value;
  }

  protected get lockAll(): MenuItemConstructorOptions {
    return {
      id: "lockAllNow",
      label: this.localize("lockAllVaults"),
      click: () => this.sendMessage("lockAllVaults"),
      accelerator: "CmdOrCtrl+L",
      enabled: this.hasAccounts,
    };
  }

  protected get logOut(): MenuItemConstructorOptions {
    return {
      id: "logOut",
      label: this.localize("logOut"),
      submenu: this.logOutSubmenu,
      enabled: this.hasAccounts,
    };
  }

  protected get logOutSubmenu(): MenuItemConstructorOptions[] {
    const value: MenuItemConstructorOptions[] = [];
    for (const userId in this._accounts) {
      if (userId == null) {
        continue;
      }

      value.push({
        label: this._accounts[userId].email,
        id: `logOut_${this._accounts[userId].userId}`,
        click: async () => {
          const result = await dialog.showMessageBox(this._window, {
            title: this.localize("logOut"),
            message: this.localize("logOut"),
            detail: this.localize("logOutConfirmation"),
            buttons: [this.localize("logOut"), this.localize("cancel")],
            cancelId: 1,
            defaultId: 0,
            noLink: true,
          });
          if (result.response === 0) {
            this.sendMessage("logout", { userId: this._accounts[userId].userId });
          }
        },
        visible: this._accounts[userId].isAuthenticated,
      });
    }
    return value;
  }

  protected localize(s: string) {
    return this._i18nService.t(s);
  }

  protected async checkForUpdate(menuItem: MenuItem) {
    menuItem.enabled = false;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._updater.checkForUpdate(true);
    menuItem.enabled = true;
  }

  protected sendMessage(message: string, args?: any) {
    this._messagingService.send(message, args);
  }
}

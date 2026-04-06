import { BrowserWindow, dialog, MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";

import { SafeShell } from "../../platform/main/safe-shell.main";
import { isMacAppStore, isWindowsStore } from "../../utils";

import { IMenubarMenu } from "./menubar";

export class AccountMenu implements IMenubarMenu {
  readonly id: string = "accountMenu";

  get label(): string {
    return this.localize("account");
  }

  get items(): MenuItemConstructorOptions[] {
    const items = [this.premiumMembership];
    if (this._hasMasterPassword) {
      items.push(this.changeMasterPassword);
    }
    items.push(this.twoStepLogin);
    items.push(this.fingerprintPhrase);
    items.push(this.separator);
    items.push(this.deleteAccount);
    return items;
  }

  private readonly _i18nService: I18nService;
  private readonly _messagingService: MessagingService;
  private readonly _webVaultUrl: string;
  private readonly _window: BrowserWindow;
  private readonly _isLocked: boolean;
  private readonly _hasMasterPassword: boolean;
  // TODO: PM-32419 - remove once multi client password management is fully rolled out
  private readonly _multiClientPasswordManagement: boolean;

  constructor(
    i18nService: I18nService,
    messagingService: MessagingService,
    webVaultUrl: string,
    window: BrowserWindow,
    isLocked: boolean,
    hasMasterPassword: boolean,
    multiClientPasswordManagement: boolean = false,
    private shell: SafeShell,
  ) {
    this._i18nService = i18nService;
    this._messagingService = messagingService;
    this._webVaultUrl = webVaultUrl;
    this._window = window;
    this._isLocked = isLocked;
    this._hasMasterPassword = hasMasterPassword;
    // TODO: PM-32419 - remove once multi client password management is fully rolled out
    this._multiClientPasswordManagement = multiClientPasswordManagement;
  }

  private get premiumMembership(): MenuItemConstructorOptions {
    return {
      label: this.localize("premiumMembership"),
      click: () => this.sendMessage("openPremium"),
      id: "premiumMembership",
      visible: !isWindowsStore() && !isMacAppStore(),
      enabled: !this._isLocked,
    };
  }

  private get changeMasterPassword(): MenuItemConstructorOptions {
    // TODO: PM-32419 - remove feature flag check once fully rolled out
    if (this._multiClientPasswordManagement) {
      return {
        // TODO: PM-32419 - remove "changeMasterPass" translation since we now use changeMasterPassword
        label: this.localize("changeMasterPassword"),
        id: "changeMasterPassword",
        click: () => this.sendMessage("openChangePasswordDialog"),
        enabled: !this._isLocked,
      };
    }
    // TODO: PM-32419 - remove old change password menu item once multi client password management is fully rolled out
    return {
      label: this.localize("changeMasterPass"),
      id: "changeMasterPass",
      click: async () => {
        const result = await dialog.showMessageBox(this._window, {
          title: this.localize("continueToWebApp"),
          message: this.localize("continueToWebApp"),
          detail: this.localize("changeMasterPasswordOnWebConfirmation"),
          buttons: [this.localize("continue"), this.localize("cancel")],
          cancelId: 1,
          defaultId: 0,
          noLink: true,
        });
        if (result.response === 0) {
          void this.shell.openExternal(this._webVaultUrl, UrlType.WebUrl);
        }
      },
      enabled: !this._isLocked,
    };
  }

  private get twoStepLogin(): MenuItemConstructorOptions {
    return {
      label: this.localize("twoStepLogin"),
      id: "twoStepLogin",
      click: async () => {
        const result = await dialog.showMessageBox(this._window, {
          title: this.localize("twoStepLogin"),
          message: this.localize("twoStepLogin"),
          detail: this.localize("twoStepLoginConfirmation"),
          buttons: [this.localize("yes"), this.localize("no")],
          cancelId: 1,
          defaultId: 0,
          noLink: true,
        });
        if (result.response === 0) {
          void this.shell.openExternal(this._webVaultUrl, UrlType.WebUrl);
        }
      },
      enabled: !this._isLocked,
    };
  }

  private get fingerprintPhrase(): MenuItemConstructorOptions {
    return {
      label: this.localize("fingerprintPhrase"),
      id: "fingerprintPhrase",
      click: () => this.sendMessage("showFingerprintPhrase"),
      enabled: !this._isLocked,
    };
  }

  private get deleteAccount(): MenuItemConstructorOptions {
    return {
      label: this.localize("deleteAccount"),
      id: "deleteAccount",
      click: () => this.sendMessage("deleteAccount"),
      enabled: !this._isLocked,
    };
  }

  private get separator(): MenuItemConstructorOptions {
    return { type: "separator" };
  }

  private localize(s: string) {
    return this._i18nService.t(s);
  }

  private sendMessage(message: string, args?: any) {
    this._messagingService.send(message, args);
  }
}

import { BrowserWindow, MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherType } from "@bitwarden/sdk-internal";

import { isMac } from "../../utils";
import { UpdaterMain } from "../updater.main";

import { FirstMenu } from "./menu.first";
import { MenuAccount } from "./menu.updater";
import { IMenubarMenu } from "./menubar";

// AKA: "FirstMenu" or "MacMenu" - the first menu that shows on all macOs apps
export class BitwardenMenu extends FirstMenu implements IMenubarMenu {
  readonly id: string = "bitwarden";
  readonly label: string = "Bitwarden";

  get items(): MenuItemConstructorOptions[] {
    const items = [this.aboutBitwarden, this.checkForUpdates];
    if (this.aboutBitwarden.visible === true || this.checkForUpdates.visible === true) {
      items.push(this.separator);
    }
    items.push(this.settings);
    items.push(this.lock);
    items.push(this.lockAll);
    items.push(this.logOut);
    items.push(this.separator);
    items.push(this.services);

    if (
      this.hideBitwarden.visible === true ||
      this.hideOthers.visible === true ||
      this.showAll.visible === true
    ) {
      items.push(this.separator);
    }

    items.push(this.hideBitwarden);
    items.push(this.hideOthers);
    items.push(this.showAll);

    if (this.quitBitwarden.visible === true) {
      items.push(this.separator);
    }
    items.push(this.quitBitwarden);
    return items;
  }

  constructor(
    i18nService: I18nService,
    messagingService: MessagingService,
    updater: UpdaterMain,
    window: BrowserWindow,
    accounts: { [userId: string]: MenuAccount },
    isLocked: boolean,
    isLockable: boolean,
    restrictedCipherTypes: CipherType[],
  ) {
    super(
      i18nService,
      messagingService,
      updater,
      window,
      accounts,
      isLocked,
      isLockable,
      restrictedCipherTypes,
    );
  }

  private get aboutBitwarden(): MenuItemConstructorOptions {
    return {
      id: "aboutBitwarden",
      label: this.localize("aboutBitwarden"),
      role: "about",
      visible: isMac(),
    };
  }

  private get services(): MenuItemConstructorOptions {
    return {
      id: "services",
      label: this.localize("services"),
      role: "services",
      submenu: [],
      visible: isMac(),
    };
  }

  private get hideBitwarden(): MenuItemConstructorOptions {
    return {
      id: "hideBitwarden",
      label: this.localize("hideBitwarden"),
      role: "hide",
      visible: isMac(),
    };
  }

  private get hideOthers(): MenuItemConstructorOptions {
    return {
      id: "hideOthers",
      label: this.localize("hideOthers"),
      role: "hideOthers",
      visible: isMac(),
    };
  }

  private get showAll(): MenuItemConstructorOptions {
    return {
      id: "showAll",
      label: this.localize("showAll"),
      role: "unhide",
      visible: isMac(),
    };
  }

  private get quitBitwarden(): MenuItemConstructorOptions {
    return {
      id: "quitBitwarden",
      label: this.localize("quitBitwarden"),
      role: "quit",
      visible: isMac(),
    };
  }
}

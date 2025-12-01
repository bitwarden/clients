// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Menu, MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { VersionMain } from "../../platform/main/version.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { isMac } from "../../utils";
import { UpdaterMain } from "../updater.main";
import { WindowMain } from "../window.main";

import { AboutMenu } from "./menu.about";
import { AccountMenu } from "./menu.account";
import { BitwardenMenu } from "./menu.bitwarden";
import { EditMenu } from "./menu.edit";
import { FileMenu } from "./menu.file";
import { HelpMenu } from "./menu.help";
import { MenuUpdateRequest } from "./menu.updater";
import { ViewMenu } from "./menu.view";
import { WindowMenu } from "./menu.window";

export interface IMenubarMenu {
  id: string;
  label: string;
  visible?: boolean; // Assumes true if null
  items: MenuItemConstructorOptions[];
}

export class Menubar {
  private readonly items: IMenubarMenu[];

  get menu(): Menu {
    const template: MenuItemConstructorOptions[] = [];
    if (this.items != null) {
      this.items.forEach((item: IMenubarMenu) => {
        if (item != null) {
          template.push({
            id: item.id,
            label: item.label,
            submenu: item.items,
            visible: item.visible ?? true,
          });
        }
      });
    }
    return Menu.buildFromTemplate(template);
  }

  constructor(
    i18nService: I18nService,
    messagingService: MessagingService,
    desktopSettingsService: DesktopSettingsService,
    updaterMain: UpdaterMain,
    windowMain: WindowMain,
    webVaultUrl: string,
    appVersion: string,
    hardwareAccelerationEnabled: boolean,
    versionMain: VersionMain,
    updateRequest?: MenuUpdateRequest,
  ) {
    let isLocked = true;
    if (
      updateRequest != null &&
      updateRequest.accounts != null &&
      updateRequest.activeUserId != null
    ) {
      isLocked = updateRequest.accounts[updateRequest.activeUserId]?.isLocked ?? true;
    }

    const isLockable =
      !isLocked && updateRequest?.accounts?.[updateRequest.activeUserId]?.isLockable;
    const hasMasterPassword =
      updateRequest?.accounts?.[updateRequest.activeUserId]?.hasMasterPassword ?? false;

    this.items = [
      new FileMenu(
        i18nService,
        messagingService,
        updaterMain,
        windowMain.win,
        updateRequest?.accounts,
        isLocked,
        isLockable,
        updateRequest?.restrictedCipherTypes,
      ),
      new EditMenu(i18nService, messagingService, isLocked),
      new ViewMenu(i18nService, messagingService, isLocked, windowMain),
      new AccountMenu(
        i18nService,
        messagingService,
        webVaultUrl,
        windowMain.win,
        isLocked,
        hasMasterPassword,
      ),
      new WindowMenu(i18nService, messagingService, windowMain),
      new HelpMenu(
        i18nService,
        desktopSettingsService,
        webVaultUrl,
        hardwareAccelerationEnabled,
        new AboutMenu(i18nService, appVersion, windowMain.win, updaterMain, versionMain),
      ),
    ];

    if (isMac()) {
      this.items = [
        ...[
          new BitwardenMenu(
            i18nService,
            messagingService,
            updaterMain,
            windowMain.win,
            updateRequest?.accounts,
            isLocked,
            isLockable,
          ),
        ],
        ...this.items,
      ];
    }
  }
}

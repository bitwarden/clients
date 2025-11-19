// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { isDev } from "../../utils";
import { WindowMain } from "../window.main";

import { IMenubarMenu } from "./menubar";

export class ViewMenu implements IMenubarMenu {
  readonly id: "viewMenu";

  get label(): string {
    return this.localize("view");
  }

  get items(): MenuItemConstructorOptions[] {
    const items = [
      this.searchVault,
      this.separator,
      this.generator,
      this.passwordHistory,
      this.separator,
      this.zoomIn,
      this.zoomOut,
      this.resetZoom,
      this.separator,
      this.toggleFullscreen,
      this.separator,
      this.reload,
    ];

    if (isDev()) {
      items.push(this.toggleDevTools);
    }

    return items;
  }

  private readonly _i18nService: I18nService;
  private readonly _messagingService: MessagingService;
  private readonly _isLocked: boolean;
  private readonly _windowMain: WindowMain;

  constructor(
    i18nService: I18nService,
    messagingService: MessagingService,
    isLocked: boolean,
    windowMain: WindowMain,
  ) {
    this._i18nService = i18nService;
    this._messagingService = messagingService;
    this._isLocked = isLocked;
    this._windowMain = windowMain;
  }

  private get searchVault(): MenuItemConstructorOptions {
    return {
      id: "searchVault",
      label: this.localize("searchVault"),
      click: () => this.sendMessage("focusSearch"),
      accelerator: "CmdOrCtrl+F",
      enabled: !this._isLocked,
    };
  }

  private get separator(): MenuItemConstructorOptions {
    return { type: "separator" };
  }

  private get generator(): MenuItemConstructorOptions {
    return {
      id: "generator",
      label: this.localize("generator"),
      click: () => this.sendMessage("openGenerator"),
      accelerator: "CmdOrCtrl+G",
      enabled: !this._isLocked,
    };
  }

  private get passwordHistory(): MenuItemConstructorOptions {
    return {
      id: "passwordHistory",
      label: this.localize("generatorHistory"),
      click: () => this.sendMessage("openPasswordHistory"),
      enabled: !this._isLocked,
    };
  }

  private get zoomIn(): MenuItemConstructorOptions {
    return {
      id: "zoomIn",
      label: this.localize("zoomIn"),
      click: async () => {
        const currentZoom = this._windowMain.win.webContents.zoomFactor;
        const newZoom = currentZoom + 0.1;
        this._windowMain.win.webContents.zoomFactor = newZoom;
        await this._windowMain.saveZoomFactor(newZoom);
      },
      accelerator: "CmdOrCtrl+=",
    };
  }

  private get zoomOut(): MenuItemConstructorOptions {
    return {
      id: "zoomOut",
      label: this.localize("zoomOut"),
      click: async () => {
        const currentZoom = this._windowMain.win.webContents.zoomFactor;
        const newZoom = Math.max(0.2, currentZoom - 0.1);
        this._windowMain.win.webContents.zoomFactor = newZoom;
        await this._windowMain.saveZoomFactor(newZoom);
      },
      accelerator: "CmdOrCtrl+-",
    };
  }

  private get resetZoom(): MenuItemConstructorOptions {
    return {
      id: "resetZoom",
      label: this.localize("resetZoom"),
      click: async () => {
        const newZoom = 1.0;
        this._windowMain.win.webContents.zoomFactor = newZoom;
        await this._windowMain.saveZoomFactor(newZoom);
      },
      accelerator: "CmdOrCtrl+0",
    };
  }

  private get toggleFullscreen(): MenuItemConstructorOptions {
    return {
      id: "toggleFullScreen",
      label: this.localize("toggleFullScreen"),
      role: "togglefullscreen",
    };
  }

  private get reload(): MenuItemConstructorOptions {
    return {
      id: "reload",
      label: this.localize("reload"),
      role: "forceReload",
    };
  }

  private get toggleDevTools(): MenuItemConstructorOptions {
    return {
      id: "toggleDevTools",
      label: this.localize("toggleDevTools"),
      role: "toggleDevTools",
      accelerator: "F12",
    };
  }

  private localize(s: string) {
    return this._i18nService.t(s);
  }

  private sendMessage(message: string) {
    this._messagingService.send(message);
  }
}

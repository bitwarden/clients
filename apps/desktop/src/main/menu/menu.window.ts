// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { isMac } from "../../utils";
import { WindowMain } from "../window.main";

import { IMenubarMenu } from "./menubar";

export class WindowMenu implements IMenubarMenu {
  readonly id: string;

  get label(): string {
    return this.localize("window");
  }

  get items(): MenuItemConstructorOptions[] {
    const items = [this.minimize, this.hideToMenu, this.alwaysOnTop];

    if (isMac()) {
      items.push(this.zoom, this.separator, this.bringAllToFront);
    }

    items.push(this.separator, this.close);
    return items;
  }

  private readonly _i18nService: I18nService;
  private readonly _messagingService: MessagingService;
  private readonly _window: WindowMain;

  constructor(
    i18nService: I18nService,
    messagingService: MessagingService,
    windowMain: WindowMain,
  ) {
    this._i18nService = i18nService;
    this._messagingService = messagingService;
    this._window = windowMain;
  }

  private get minimize(): MenuItemConstructorOptions {
    return {
      id: "minimize",
      label: this.localize("minimize"),
      role: "minimize",
    };
  }

  private get hideToMenu(): MenuItemConstructorOptions {
    return {
      id: "hideToMenu",
      label: this.localize(isMac() ? "hideToMenuBar" : "hideToTray"),
      click: () => this.sendMessage("hideToTray"),
      accelerator: "CmdOrCtrl+Shift+M",
    };
  }

  private get alwaysOnTop(): MenuItemConstructorOptions {
    return {
      id: "alwaysOnTop",
      label: this.localize("alwaysOnTop"),
      type: "checkbox",
      checked: this._window.win.isAlwaysOnTop(),
      click: () => this._window.toggleAlwaysOnTop(),
      accelerator: "CmdOrCtrl+Shift+T",
    };
  }

  private get zoom(): MenuItemConstructorOptions {
    return {
      id: "zoom",
      label: this.localize("zoom"),
      role: "zoom",
    };
  }

  private get separator(): MenuItemConstructorOptions {
    return { type: "separator" };
  }

  private get bringAllToFront(): MenuItemConstructorOptions {
    return {
      id: "bringAllToFront",
      label: this.localize("bringAllToFront"),
      role: "front",
    };
  }

  private get close(): MenuItemConstructorOptions {
    return {
      id: "close",
      label: this.localize("close"),
      role: "close",
    };
  }

  private localize(s: string) {
    return this._i18nService.t(s);
  }

  private sendMessage(message: string, args?: any) {
    this._messagingService.send(message, args);
  }
}

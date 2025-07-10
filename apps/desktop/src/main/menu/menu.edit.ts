import { MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { IMenubarMenu } from "./menubar";

export class EditMenu implements IMenubarMenu {
  readonly id: string = "editMenu";

  get label(): string {
    return this.localize("edit");
  }

  get items(): MenuItemConstructorOptions[] {
    return [
      this.undo,
      this.redo,
      this.separator,
      this.cut,
      this.copy,
      this.paste,
      this.separator,
      this.selectAll,
      this.separator,
      this.copyUsername,
      this.copyPassword,
      this.copyVerificationCodeTotp,
    ];
  }

  private readonly _i18nService: I18nService;
  private readonly _messagingService: MessagingService;
  private readonly _isLocked: boolean;

  constructor(i18nService: I18nService, messagingService: MessagingService, isLocked: boolean) {
    this._i18nService = i18nService;
    this._messagingService = messagingService;
    this._isLocked = isLocked;
  }

  private get undo(): MenuItemConstructorOptions {
    return {
      id: "undo",
      label: this.localize("undo"),
      role: "undo",
    };
  }

  private get redo(): MenuItemConstructorOptions {
    return {
      id: "redo",
      label: this.localize("redo"),
      role: "redo",
    };
  }

  private get separator(): MenuItemConstructorOptions {
    return { type: "separator" };
  }

  private get cut(): MenuItemConstructorOptions {
    return {
      id: "cut",
      label: this.localize("cut"),
      role: "cut",
    };
  }

  private get copy(): MenuItemConstructorOptions {
    return {
      id: "copy",
      label: this.localize("copy"),
      role: "copy",
    };
  }

  private get paste(): MenuItemConstructorOptions {
    return {
      id: "paste",
      label: this.localize("paste"),
      role: "paste",
    };
  }

  private get selectAll(): MenuItemConstructorOptions {
    return {
      id: "selectAll",
      label: this.localize("selectAll"),
      role: "selectAll",
    };
  }

  private get copyUsername(): MenuItemConstructorOptions {
    return {
      label: this.localize("copyUsername"),
      id: "copyUsername",
      click: () => this.sendMessage("copyUsername"),
      accelerator: "CmdOrCtrl+U",
      enabled: !this._isLocked,
    };
  }

  private get copyPassword(): MenuItemConstructorOptions {
    return {
      label: this.localize("copyPassword"),
      id: "copyPassword",
      click: () => this.sendMessage("copyPassword"),
      accelerator: "CmdOrCtrl+P",
      enabled: !this._isLocked,
    };
  }

  private get copyVerificationCodeTotp(): MenuItemConstructorOptions {
    return {
      label: this.localize("copyVerificationCodeTotp"),
      id: "copyTotp",
      click: () => this.sendMessage("copyTotp"),
      accelerator: "CmdOrCtrl+T",
      enabled: !this._isLocked,
    };
  }

  private localize(s: string) {
    return this._i18nService.t(s);
  }

  private sendMessage(message: string) {
    this._messagingService.send(message);
  }
}

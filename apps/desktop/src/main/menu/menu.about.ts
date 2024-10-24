import { BrowserWindow, clipboard, dialog, MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { VersionMain } from "../../platform/main/version.main";
import { isMacAppStore, isSnapStore, isWindowsStore } from "../../utils";
import { UpdaterMain } from "../updater.main";

import { IMenubarMenu } from "./menubar";

export class AboutMenu implements IMenubarMenu {
  readonly id: string = "about";

  get label(): string {
    return "";
  }

  get items(): MenuItemConstructorOptions[] {
    return [this.separator, this.checkForUpdates, this.aboutBitwarden];
  }

  private readonly _i18nService: I18nService;
  private readonly _updater: UpdaterMain;
  private readonly _window: BrowserWindow;
  private readonly _version: string;
  private readonly _versionMain: VersionMain;

  constructor(
    i18nService: I18nService,
    version: string,
    window: BrowserWindow,
    updater: UpdaterMain,
    versionMain: VersionMain,
  ) {
    this._i18nService = i18nService;
    this._updater = updater;
    this._version = version;
    this._window = window;
    this._versionMain = versionMain;
  }

  private get separator(): MenuItemConstructorOptions {
    return { type: "separator" };
  }

  private get checkForUpdates(): MenuItemConstructorOptions {
    return {
      id: "checkForUpdates",
      label: this.localize("checkForUpdates"),
      visible: !isWindowsStore() && !isSnapStore() && !isMacAppStore(),
      click: () => this.checkForUpdate(),
    };
  }

  private get aboutBitwarden(): MenuItemConstructorOptions {
    return {
      id: "aboutBitwarden",
      label: this.localize("aboutBitwarden"),
      click: async () => {
        const sdkVersion = await this._versionMain.sdkVersion();
        const aboutInformation =
          this.localize("version", this._version) +
          "\nSDK " +
          sdkVersion +
          "\nShell " +
          process.versions.electron +
          "\nRenderer " +
          process.versions.chrome +
          "\nNode " +
          process.versions.node +
          "\nArchitecture " +
          process.arch;
        const result = await dialog.showMessageBox(this._window, {
          title: "Bitwarden",
          message: "Bitwarden",
          detail: aboutInformation,
          type: "info",
          noLink: true,
          buttons: [this.localize("ok"), this.localize("copy")],
        });
        if (result.response === 1) {
          clipboard.writeText(aboutInformation);
        }
      },
    };
  }

  private localize(s: string, p?: string) {
    return this._i18nService.t(s, p);
  }

  private async checkForUpdate() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._updater.checkForUpdate(true);
  }
}

import * as path from "path";

import { app, dialog, ipcMain, Menu, MenuItem, nativeTheme, Notification } from "electron";

import { ThemeType } from "@bitwarden/common/platform/enums";
import { MessageSender, CommandDefinition } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- Using implementation helper in implementation
import { getCommand } from "@bitwarden/common/platform/messaging/internal";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";

import { WindowMain } from "../main/window.main";
import { SafeShell } from "../platform/main/safe-shell.main";
import { RendererMenuItem } from "../utils";

export class ElectronMainMessagingService implements MessageSender {
  constructor(
    private windowMain: WindowMain,
    private shell: SafeShell,
  ) {
    ipcMain.handle("appVersion", () => {
      return app.getVersion();
    });

    ipcMain.handle("systemTheme", () => {
      return nativeTheme.shouldUseDarkColors ? ThemeType.Dark : ThemeType.Light;
    });

    ipcMain.handle("showMessageBox", (event, options) => {
      return dialog.showMessageBox(this.windowMain.win, options);
    });

    ipcMain.handle("openContextMenu", (event, options: { menu: RendererMenuItem[] }) => {
      return new Promise((resolve) => {
        const menu = new Menu();
        options.menu.forEach((m, index) => {
          menu.append(
            new MenuItem({
              label: m.label,
              type: m.type,
              click: () => {
                resolve(index);
              },
            }),
          );
        });
        menu.popup({
          window: windowMain.win,
          callback: () => {
            resolve(-1);
          },
        });
      });
    });

    ipcMain.handle("windowVisible", () => {
      return windowMain.win?.isVisible();
    });

    ipcMain.handle("loginRequest", async (event, options) => {
      const alert = new Notification({
        title: options.alertTitle,
        body: options.alertBody,
        closeButtonText: options.buttonText,
        icon: path.join(__dirname, "images/icon.png"),
      });

      alert.addListener("click", () => {
        this.windowMain.win.show();
      });

      alert.show();
    });

    ipcMain.handle("launchUri", async (event, uri) => {
      void this.shell.openExternal(uri, UrlType.CipherUri);
    });

    nativeTheme.on("updated", () => {
      windowMain.win?.webContents.send(
        "systemThemeUpdated",
        nativeTheme.shouldUseDarkColors ? ThemeType.Dark : ThemeType.Light,
      );
    });
  }

  send<T extends Record<string, unknown>>(
    commandDefinition: CommandDefinition<T> | string,
    arg: T | Record<string, unknown> = {},
  ) {
    const command = getCommand(commandDefinition);
    const message = Object.assign({}, { command: command }, arg);
    if (this.windowMain.win != null) {
      this.windowMain.win.webContents.send("messagingService", message);
    }
  }
}

import * as path from "path";

import { app, dialog, ipcMain, nativeTheme, Notification } from "electron";

import { ThemeType } from "@bitwarden/common/platform/enums";
import { MessageSender, CommandDefinition } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- Using implementation helper in implementation
import { getCommand } from "@bitwarden/common/platform/messaging/internal";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";

import { WindowMain } from "../main/window.main";
import { SafeShell } from "../platform/main/safe-shell.main";
import { isAllowedNotificationRoute } from "../platform/notification-routes";

export class ElectronMainMessagingService implements MessageSender {
  // Held until shown notifications close, or the platform may collect them and drop their click.
  private activeNotifications = new Set<Notification>();

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
        this.windowMain.withWindow((win) => win.show());
      });

      alert.show();
    });

    ipcMain.handle("showNotification", (event, options) => this.showNotification(options));

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

  private showNotification(options: unknown): boolean {
    if (!Notification.isSupported()) {
      return false;
    }
    const { title, body, route } = (options ?? {}) as Record<string, unknown>;
    if (typeof title !== "string" || typeof body !== "string") {
      return false;
    }
    if (route != null && !isAllowedNotificationRoute(route)) {
      return false;
    }

    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, "images/icon.png"),
    });
    const release = () => this.activeNotifications.delete(notification);
    notification.addListener("click", () => {
      this.windowMain.withWindow((win) => {
        if (win.isMinimized()) {
          win.restore();
        }
        win.show();
        win.focus();
      });
      if (route != null) {
        this.send("navigateToRoute", { route });
      }
      release();
    });
    notification.addListener("close", release);
    notification.addListener("failed", release);
    this.activeNotifications.add(notification);
    notification.show();
    return true;
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

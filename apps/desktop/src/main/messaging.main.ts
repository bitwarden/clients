// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { app, ipcMain } from "electron";
import { firstValueFrom } from "rxjs";

import { autostart } from "@bitwarden/desktop-napi";

import { Main } from "../main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { MenuUpdateRequest } from "./menu/menu.updater";

const SyncInterval = 5 * 60 * 1000; // 5 minutes
export const AUTOSTART_FLAG = "--autostart";

export class MessagingMain {
  private syncTimeout: NodeJS.Timeout;

  constructor(
    private main: Main,
    private desktopSettingsService: DesktopSettingsService,
  ) {}

  async init() {
    this.scheduleNextSync();

    // On app start, regenerate the configurations needed to autostart or not auto-start
    // depending on the setting provided in the settings file.
    const openAtLogin = await firstValueFrom(this.desktopSettingsService.openAtLogin$);
    this.setOpenAtLogin(openAtLogin);

    ipcMain.on(
      "messagingService",
      async (event: any, message: any) => await this.onMessage(message),
    );
  }

  async onMessage(message: any) {
    switch (message.command) {
      case "loadurl":
        // TODO: Remove this once fakepopup is removed from tray (just used for dev)
        await this.main.windowMain.loadUrl(message.url, message.modal);
        break;
      case "scheduleNextSync":
        this.scheduleNextSync();
        break;
      case "updateAppMenu":
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.main.menuMain.updateApplicationMenuState(message.updateRequest);
        this.updateTrayMenu(message.updateRequest);
        break;
      case "minimizeOnCopy":
        {
          const shouldMinimizeOnCopy = await firstValueFrom(
            this.desktopSettingsService.minimizeOnCopy$,
          );
          if (shouldMinimizeOnCopy && this.main.windowMain.win !== null) {
            this.main.windowMain.win.minimize();
          }
        }
        break;
      case "hideToTray":
        this.main.trayMain.hideToTray();
        break;
      case "addOpenAtLogin":
        this.setOpenAtLogin(true);
        break;
      case "removeOpenAtLogin":
        this.setOpenAtLogin(false);
        break;
      case "setFocus":
        await this.setFocus();
        break;
      case "getWindowIsFocused":
        this.windowIsFocused();
        break;
      default:
        break;
    }
  }

  private scheduleNextSync() {
    if (this.syncTimeout) {
      global.clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = global.setTimeout(() => {
      if (this.main.windowMain.win == null) {
        return;
      }

      this.main.windowMain.win.webContents.send("messagingService", {
        command: "checkSyncVault",
      });
    }, SyncInterval);
  }

  private updateTrayMenu(updateRequest: MenuUpdateRequest) {
    if (
      this.main.trayMain == null ||
      this.main.trayMain.contextMenu == null ||
      updateRequest?.activeUserId == null
    ) {
      return;
    }
    const lockVaultTrayMenuItem = this.main.trayMain.contextMenu.getMenuItemById("lockVault");
    const activeAccount = updateRequest.accounts[updateRequest.activeUserId];
    if (lockVaultTrayMenuItem != null && activeAccount != null) {
      lockVaultTrayMenuItem.enabled = activeAccount.isAuthenticated && !activeAccount.isLocked;
    }
    this.main.trayMain.updateContextMenu();
  }

  // On Linux all the autostart setup (Flatpak portal, Snap, and plain-Linux .desktop file
  // management) is handled by the Rust native module; here we only gather the values Electron
  // knows and delegate. macOS/Windows use Electron's login-item API, which has no Rust equivalent.
  private setOpenAtLogin(enabled: boolean) {
    if (process.platform === "linux") {
      autostart
        .setAutostart(enabled, {
          execPath: app.getPath("exe"),
          autostartFlag: AUTOSTART_FLAG,
        })
        .catch((e) => {
          this.main.logService.error("Error setting autostart", e);
        });
    } else {
      app.setLoginItemSettings({ openAtLogin: enabled, args: enabled ? [AUTOSTART_FLAG] : [] });
    }
  }

  private async setFocus() {
    await this.main.trayMain.restoreFromTray();
    this.main.windowMain.win.focusOnWebView();
  }

  private windowIsFocused() {
    const windowIsFocused = this.main.windowMain.win.isFocused();
    this.main.windowMain.win.webContents.send("messagingService", {
      command: "windowIsFocused",
      windowIsFocused: windowIsFocused,
    });
  }
}

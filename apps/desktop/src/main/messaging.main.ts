// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";
import * as path from "path";

import { app, ipcMain } from "electron";
import { firstValueFrom } from "rxjs";

import { Main } from "../main";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { MenuUpdateRequest } from "./menu/menu.updater";

const SyncInterval = 5 * 60 * 1000; // 5 minutes

export class MessagingMain {
  private syncTimeout: NodeJS.Timeout;

  constructor(
    private main: Main,
    private desktopSettingsService: DesktopSettingsService,
  ) {}

  async init() {
    this.scheduleNextSync();
    if (process.platform === "linux") {
      await this.desktopSettingsService.setOpenAtLogin(fs.existsSync(this.linuxStartupFile()));
    } else {
      const loginSettings = app.getLoginItemSettings();
      await this.desktopSettingsService.setOpenAtLogin(loginSettings.openAtLogin);
    }
    ipcMain.on(
      "messagingService",
      async (event: any, message: any) => await this.onMessage(message),
    );
  }

  async onMessage(message: any) {
    switch (message.command) {
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
      case "showTray":
        this.main.trayMain.showTray();
        break;
      case "removeTray":
        this.main.trayMain.removeTray();
        break;
      case "hideToTray":
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.main.trayMain.hideToTray();
        break;
      case "addOpenAtLogin":
        this.addOpenAtLogin();
        break;
      case "removeOpenAtLogin":
        this.removeOpenAtLogin();
        break;
      case "setFocus":
        this.setFocus();
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

  private addOpenAtLogin() {
    if (process.platform === "linux") {
      const data = `[Desktop Entry]
Type=Application
Version=${app.getVersion()}
Name=Bitwarden
Comment=Bitwarden startup script
Exec=${app.getPath("exe")}
StartupNotify=false
Terminal=false`;

      const dir = path.dirname(this.linuxStartupFile());
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      fs.writeFileSync(this.linuxStartupFile(), data);
    } else {
      app.setLoginItemSettings({ openAtLogin: true });
    }
  }

  private removeOpenAtLogin() {
    if (process.platform === "linux") {
      if (fs.existsSync(this.linuxStartupFile())) {
        fs.unlinkSync(this.linuxStartupFile());
      }
    } else {
      app.setLoginItemSettings({ openAtLogin: false });
    }
  }

  private linuxStartupFile(): string {
    return path.join(app.getPath("home"), ".config", "autostart", "bitwarden.desktop");
  }

  private setFocus() {
    this.main.trayMain.restoreFromTray();
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

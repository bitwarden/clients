// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";
import { firstValueFrom } from "rxjs";

import { Main } from "../main";
import { AutoStartService } from "../platform/auto-start";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { MenuUpdateRequest } from "./menu/menu.updater";

const SyncInterval = 5 * 60 * 1000; // 5 minutes

export class MessagingMain {
  private syncTimeout: NodeJS.Timeout;

  constructor(
    private main: Main,
    private desktopSettingsService: DesktopSettingsService,
    private autoStartService: AutoStartService,
  ) {}

  init() {
    this.scheduleNextSync();
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
        await this.autoStartService.enable();
        break;
      case "removeOpenAtLogin":
        await this.autoStartService.disable();
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

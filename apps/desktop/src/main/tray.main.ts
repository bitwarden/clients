// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";

import { app, BrowserWindow, Menu, MenuItemConstructorOptions, nativeImage, Tray } from "electron";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@bitwarden/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";
import { isDev } from "../utils";

import { WindowMain } from "./window.main";

export class TrayMain {
  contextMenu: Menu;

  private appName: string;
  private tray: Tray;
  private icon: string | Electron.NativeImage;
  private pressedIcon: Electron.NativeImage;

  constructor(
    private windowMain: WindowMain,
    private i18nService: I18nService,
    private desktopSettingsService: DesktopSettingsService,
    private messagingService: MessagingService,
    private biometricService: BiometricsService,
  ) {
    if (process.platform === "win32") {
      this.icon = path.join(__dirname, "/images/icon.ico");
    } else if (process.platform === "darwin") {
      const nImage = nativeImage.createFromPath(path.join(__dirname, "/images/icon-template.png"));
      nImage.setTemplateImage(true);
      this.icon = nImage;
      this.pressedIcon = nativeImage.createFromPath(
        path.join(__dirname, "/images/icon-highlight.png"),
      );
    } else {
      this.icon = path.join(__dirname, "/images/icon.png");
    }
  }

  async init(appName: string, additionalMenuItems: MenuItemConstructorOptions[] = null) {
    this.appName = appName;

    const menuItemOptions: MenuItemConstructorOptions[] = [
      {
        label: this.i18nService.t("showHide"),
        click: () => this.toggleWindow(),
      },
      {
        visible: isDev(),
        label: "Fake Popup Select",
        click: () => this.fakePopup(),
      },
      {
        visible: isDev(),
        label: "Fake Popup Create",
        click: () => this.fakePopupCreate(),
      },
      { type: "separator" },
      {
        label: this.i18nService.t("exit"),
        click: () => this.closeWindow(),
      },
    ];

    if (additionalMenuItems != null) {
      menuItemOptions.splice(1, 0, ...additionalMenuItems);
    }

    this.contextMenu = Menu.buildFromTemplate(menuItemOptions);
    if (await firstValueFrom(this.desktopSettingsService.trayEnabled$)) {
      this.showTray();
    }
  }

  setupWindowListeners(win: BrowserWindow) {
    win.on("minimize", async () => {
      if (await firstValueFrom(this.desktopSettingsService.minimizeToTray$)) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.hideToTray();
      }
    });

    win.on("restore", async () => {
      await this.biometricService.setShouldAutopromptNow(true);
    });

    win.on("close", async (e: Event) => {
      if (await firstValueFrom(this.desktopSettingsService.closeToTray$)) {
        if (!this.windowMain.isQuitting) {
          e.preventDefault();
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.hideToTray();
        }
      }
    });

    win.on("show", async () => {
      const enableTray = await firstValueFrom(this.desktopSettingsService.trayEnabled$);
      if (!enableTray) {
        setTimeout(() => this.removeTray(false), 100);
      }
    });
  }

  removeTray(showWindow = true) {
    // Due to https://github.com/electron/electron/issues/17622
    // we cannot destroy the tray icon on linux.
    if (this.tray != null && process.platform !== "linux") {
      this.tray.destroy();
      this.tray = null;
    }

    if (showWindow && this.windowMain.win != null && !this.windowMain.win.isVisible()) {
      this.windowMain.win.show();
    }
  }

  async hideToTray() {
    this.showTray();
    if (this.windowMain.win != null) {
      this.windowMain.win.hide();
    }
    if (this.isDarwin() && !(await firstValueFrom(this.desktopSettingsService.alwaysShowDock$))) {
      this.hideDock();
    }
  }

  restoreFromTray() {
    if (this.windowMain.win == null || !this.windowMain.win.isVisible()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.toggleWindow();
    }
  }

  showTray() {
    if (this.tray != null) {
      return;
    }

    this.tray = new Tray(this.icon);
    this.tray.setToolTip(this.appName);
    this.tray.on("click", () => this.toggleWindow());
    this.tray.on("right-click", () => this.tray.popUpContextMenu(this.contextMenu));

    if (this.pressedIcon != null) {
      this.tray.setPressedImage(this.pressedIcon);
    }
    if (this.contextMenu != null && !this.isDarwin()) {
      this.tray.setContextMenu(this.contextMenu);
    }
  }

  updateContextMenu() {
    if (this.tray != null && this.contextMenu != null && this.isLinux()) {
      this.tray.setContextMenu(this.contextMenu);
    }
  }

  private hideDock() {
    app.dock.hide();
  }

  private showDock() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    app.dock.show();
  }

  private isDarwin() {
    return process.platform === "darwin";
  }

  private isLinux() {
    return process.platform === "linux";
  }

  private async toggleWindow() {
    if (this.windowMain.win == null) {
      if (this.isDarwin()) {
        // On MacOS, closing the window via the red button destroys the BrowserWindow instance.
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.windowMain.createWindow().then(() => {
          this.windowMain.win.show();
          this.showDock();
        });
      }
      return;
    }
    if (this.windowMain.win.isVisible()) {
      this.windowMain.win.hide();
      if (this.isDarwin() && !(await firstValueFrom(this.desktopSettingsService.alwaysShowDock$))) {
        this.hideDock();
      }
    } else {
      this.windowMain.show();
      if (this.isDarwin()) {
        this.showDock();
      }
    }
  }

  private closeWindow() {
    this.windowMain.isQuitting = true;
    if (this.windowMain.win != null) {
      this.windowMain.win.close();
    }
  }

  /**
   * This method is used to test modal behavior during development and could be removed in the future.
   * @returns
   */
  private async fakePopup() {
    await this.messagingService.send("loadurl", { url: "/passkeys", modal: true });
  }

  private async fakePopupCreate() {
    await this.messagingService.send("loadurl", { url: "/create-passkey", modal: true });
  }
}

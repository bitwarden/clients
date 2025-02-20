// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { once } from "node:events";
import * as path from "path";
import * as url from "url";

import { app, BrowserWindow, ipcMain, nativeTheme, screen, session } from "electron";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { processisolations } from "@bitwarden/desktop-napi";
import { BiometricStateService } from "@bitwarden/key-management";

import { WindowState } from "../platform/models/domain/window-state";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";
import { cleanUserAgent, isDev, isLinux, isMac, isMacAppStore, isWindows } from "../utils";

const mainWindowSizeKey = "mainWindowSize";
const WindowEventHandlingDelay = 100;
export class WindowMain {
  win: BrowserWindow;
  isQuitting = false;
  isClosing = false;

  private windowStateChangeTimer: NodeJS.Timeout;
  private windowStates: { [key: string]: WindowState } = {};
  private enableAlwaysOnTop = false;
  private enableRendererProcessForceCrashReload = false;
  session: Electron.Session;

  readonly defaultWidth = 950;
  readonly defaultHeight = 600;

  constructor(
    private biometricStateService: BiometricStateService,
    private logService: LogService,
    private storageService: AbstractStorageService,
    private desktopSettingsService: DesktopSettingsService,
    private argvCallback: (argv: string[]) => void = null,
    private createWindowCallback: (win: BrowserWindow) => void,
  ) {}

  init(): Promise<any> {
    // Perform a hard reload of the render process by crashing it. This is suboptimal but ensures that all memory gets
    // cleared, as the process itself will be completely garbage collected.
    ipcMain.on("reload-process", async () => {
      this.logService.info("Reloading render process");
      // User might have changed theme, ensure the window is updated.
      this.win.setBackgroundColor(await this.getBackgroundColor());

      // By default some linux distro collect core dumps on crashes which gets written to disk.
      if (this.enableRendererProcessForceCrashReload) {
        const crashEvent = once(this.win.webContents, "render-process-gone");
        this.win.webContents.forcefullyCrashRenderer();
        await crashEvent;
      }

      this.win.webContents.reloadIgnoringCache();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.session.clearCache();
      this.logService.info("Render process reloaded");
    });

    ipcMain.on("window-focus", () => {
      if (this.win != null) {
        this.win.show();
        this.win.focus();
      }
    });

    ipcMain.on("window-hide", () => {
      if (this.win != null) {
        this.win.hide();
      }
    });

    this.desktopSettingsService.preventScreenshots$.subscribe((prevent) => {
      if (this.win == null) {
        return;
      }
      this.win.setContentProtection(prevent);
    });

    return new Promise<void>((resolve, reject) => {
      try {
        if (!isMacAppStore()) {
          const gotTheLock = app.requestSingleInstanceLock();
          if (!gotTheLock) {
            app.quit();
            return;
          } else {
            // eslint-disable-next-line
            app.on("second-instance", (event, argv, workingDirectory) => {
              // Someone tried to run a second instance, we should focus our window.
              if (this.win != null) {
                if (this.win.isMinimized() || !this.win.isVisible()) {
                  this.win.show();
                }
                this.win.focus();
              }
              if (isWindows() || isLinux()) {
                if (this.argvCallback != null) {
                  this.argvCallback(argv);
                }
              }
            });
          }
        }

        // This method will be called when Electron is shutting
        // down the application.
        app.on("before-quit", async () => {
          // Allow biometric to auto-prompt on reload
          await this.biometricStateService.resetAllPromptCancelled();
          this.isQuitting = true;
        });

        // This method will be called when Electron has finished
        // initialization and is ready to create browser windows.
        // Some APIs can only be used after this event occurs.
        app.on("ready", async () => {
          if (isMac() || isWindows()) {
            this.enableRendererProcessForceCrashReload = true;
          } else if (isLinux() && !isDev()) {
            if (await processisolations.isCoreDumpingDisabled()) {
              this.logService.info("Coredumps are disabled in renderer process");
              this.enableRendererProcessForceCrashReload = true;
            } else {
              this.logService.info("Disabling coredumps in main process");
              try {
                await processisolations.disableCoredumps();
              } catch (e) {
                this.logService.error("Failed to disable coredumps", e);
              }
            }

            // this currently breaks the file portal, so should only be used when
            // no files are needed but security requirements are super high https://github.com/flatpak/xdg-desktop-portal/issues/785
            if (process.env.EXPERIMENTAL_PREVENT_DEBUGGER_MEMORY_ACCESS === "true") {
              this.logService.info("Disabling memory dumps in main process");
              try {
                await processisolations.disableMemoryAccess();
              } catch (e) {
                this.logService.error("Failed to disable memory dumps", e);
              }
            }
          }

          await this.createWindow();
          resolve();
          if (this.argvCallback != null) {
            this.argvCallback(process.argv);
          }
        });

        // Quit when all windows are closed.
        app.on("window-all-closed", () => {
          // On OS X it is common for applications and their menu bar
          // to stay active until the user quits explicitly with Cmd + Q
          if (!isMac() || this.isQuitting || isMacAppStore()) {
            app.quit();
          }
        });

        app.on("activate", async () => {
          // On OS X it's common to re-create a window in the app when the
          // dock icon is clicked and there are no other windows open.
          if (this.win == null) {
            await this.createWindow();
          } else {
            // Show the window when clicking on Dock icon
            this.win.show();
          }
        });
      } catch (e) {
        // Catch Error
        // throw e;
        reject(e);
      }
    });
  }

  async createWindow(): Promise<void> {
    this.windowStates[mainWindowSizeKey] = await this.getWindowState(
      this.defaultWidth,
      this.defaultHeight,
    );
    this.enableAlwaysOnTop = await firstValueFrom(this.desktopSettingsService.alwaysOnTop$);

    this.session = session.fromPartition("persist:bitwarden", { cache: false });

    // Create the browser window.
    this.win = new BrowserWindow({
      width: this.windowStates[mainWindowSizeKey].width,
      height: this.windowStates[mainWindowSizeKey].height,
      minWidth: 680,
      minHeight: 500,
      x: this.windowStates[mainWindowSizeKey].x,
      y: this.windowStates[mainWindowSizeKey].y,
      title: app.name,
      icon: isLinux() ? path.join(__dirname, "/images/icon.png") : undefined,
      titleBarStyle: isMac() ? "hiddenInset" : undefined,
      show: false,
      backgroundColor: await this.getBackgroundColor(),
      alwaysOnTop: this.enableAlwaysOnTop,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        spellcheck: false,
        nodeIntegration: false,
        backgroundThrottling: false,
        contextIsolation: true,
        session: this.session,
        devTools: isDev(),
      },
    });

    this.win.webContents.on("dom-ready", () => {
      this.win.webContents.zoomFactor = this.windowStates[mainWindowSizeKey].zoomFactor ?? 1.0;
    });

    if (this.windowStates[mainWindowSizeKey].isMaximized) {
      this.win.maximize();
    }

    // Show it later since it might need to be maximized.
    this.win.show();

    // and load the index.html of the app.
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.win.loadURL(
      url.format({
        protocol: "file:",
        pathname: path.join(__dirname, "/index.html"),
        slashes: true,
      }),
      {
        userAgent: cleanUserAgent(this.win.webContents.userAgent),
      },
    );

    // Open the DevTools.
    if (isDev()) {
      this.win.webContents.openDevTools();
    }

    // Emitted when the window is closed.
    this.win.on("closed", async () => {
      this.isClosing = false;
      await this.updateWindowState(mainWindowSizeKey, this.win);

      // Dereference the window object, usually you would store window
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      this.win = null;
    });

    this.win.on("close", async () => {
      this.isClosing = true;
      await this.updateWindowState(mainWindowSizeKey, this.win);
    });

    this.win.on("maximize", async () => {
      await this.updateWindowState(mainWindowSizeKey, this.win);
    });

    this.win.on("unmaximize", async () => {
      await this.updateWindowState(mainWindowSizeKey, this.win);
    });

    this.win.on("resize", () => {
      this.windowStateChangeHandler(mainWindowSizeKey, this.win);
    });

    this.win.on("move", () => {
      this.windowStateChangeHandler(mainWindowSizeKey, this.win);
    });
    this.win.on("focus", () => {
      this.win.webContents.send("messagingService", {
        command: "windowIsFocused",
        windowIsFocused: true,
      });
    });

    firstValueFrom(this.desktopSettingsService.preventScreenshots$)
      .then((preventScreenshots) => {
        this.win.setContentProtection(preventScreenshots);
      })
      .catch((e) => {
        this.logService.error(e);
      });

    if (this.createWindowCallback) {
      this.createWindowCallback(this.win);
    }
  }

  // Retrieve the background color
  // Resolves background color missmatch when starting the application.
  async getBackgroundColor(): Promise<string> {
    let theme = await this.storageService.get("global_theming_selection");

    if (theme == null || theme === "system") {
      theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }

    switch (theme) {
      case "light":
        return "#ededed";
      case "dark":
        return "#15181e";
      case "nord":
        return "#3b4252";
    }
  }

  async toggleAlwaysOnTop() {
    this.enableAlwaysOnTop = !this.win.isAlwaysOnTop();
    this.win.setAlwaysOnTop(this.enableAlwaysOnTop);
    await this.desktopSettingsService.setAlwaysOnTop(this.enableAlwaysOnTop);
  }

  private windowStateChangeHandler(configKey: string, win: BrowserWindow) {
    global.clearTimeout(this.windowStateChangeTimer);
    this.windowStateChangeTimer = global.setTimeout(async () => {
      await this.updateWindowState(configKey, win);
    }, WindowEventHandlingDelay);
  }

  private async updateWindowState(configKey: string, win: BrowserWindow) {
    if (win == null || win.isDestroyed()) {
      return;
    }

    try {
      const bounds = win.getBounds();

      if (this.windowStates[configKey] == null) {
        this.windowStates[configKey] = await firstValueFrom(this.desktopSettingsService.window$);
        if (this.windowStates[configKey] == null) {
          this.windowStates[configKey] = <WindowState>{};
        }
      }

      this.windowStates[configKey].isMaximized = win.isMaximized();
      this.windowStates[configKey].displayBounds = screen.getDisplayMatching(bounds).bounds;

      if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) {
        this.windowStates[configKey].x = bounds.x;
        this.windowStates[configKey].y = bounds.y;
        this.windowStates[configKey].width = bounds.width;
        this.windowStates[configKey].height = bounds.height;
      }

      if (this.isClosing) {
        this.windowStates[configKey].zoomFactor = win.webContents.zoomFactor;
      }

      await this.desktopSettingsService.setWindow(this.windowStates[configKey]);
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async getWindowState(defaultWidth: number, defaultHeight: number) {
    const state = await firstValueFrom(this.desktopSettingsService.window$);

    const isValid = state != null && (this.stateHasBounds(state) || state.isMaximized);
    let displayBounds: Electron.Rectangle = null;
    if (!isValid) {
      state.width = defaultWidth;
      state.height = defaultHeight;

      displayBounds = screen.getPrimaryDisplay().bounds;
    } else if (this.stateHasBounds(state) && state.displayBounds) {
      // Check if the display where the window was last open is still available
      displayBounds = screen.getDisplayMatching(state.displayBounds).bounds;

      if (
        displayBounds.width !== state.displayBounds.width ||
        displayBounds.height !== state.displayBounds.height ||
        displayBounds.x !== state.displayBounds.x ||
        displayBounds.y !== state.displayBounds.y
      ) {
        state.x = undefined;
        state.y = undefined;
        displayBounds = screen.getPrimaryDisplay().bounds;
      }
    }

    if (displayBounds != null) {
      if (state.width > displayBounds.width && state.height > displayBounds.height) {
        state.isMaximized = true;
      }

      if (state.width > displayBounds.width) {
        state.width = displayBounds.width - 10;
      }
      if (state.height > displayBounds.height) {
        state.height = displayBounds.height - 10;
      }
    }

    return state;
  }

  private stateHasBounds(state: any): boolean {
    return (
      state != null &&
      Number.isInteger(state.x) &&
      Number.isInteger(state.y) &&
      Number.isInteger(state.width) &&
      state.width > 0 &&
      Number.isInteger(state.height) &&
      state.height > 0
    );
  }
}

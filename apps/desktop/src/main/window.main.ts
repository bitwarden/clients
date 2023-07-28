import { once } from "node:events";
import * as path from "path";
import * as url from "url";

import { app, BrowserWindow, ipcMain, nativeTheme, screen, session } from "electron";

import { WindowState } from "@bitwarden/common/models/domain/window-state";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

import { cleanUserAgent, isDev, isMacAppStore, isSnapStore } from "../utils";

const mainWindowSizeKey = "mainWindowSize";
const WindowEventHandlingDelay = 100;
export class WindowMain {
  win: BrowserWindow;
  isQuitting = false;
  isClosing = false;

  private windowStateChangeTimer: NodeJS.Timer;
  private windowStates: { [key: string]: WindowState } = {};
  private enableAlwaysOnTop = false;
  private session: Electron.Session;

  readonly defaultWidth = 950;
  readonly defaultHeight = 600;

  constructor(
    private stateService: StateService,
    private logService: LogService,
    private storageService: AbstractStorageService,
    private argvCallback: (argv: string[]) => void = null,
    private createWindowCallback: (win: BrowserWindow) => void
  ) {}

  init(): Promise<any> {
    // Perform a hard reload of the render process by crashing it. This is suboptimal but ensures that all memory gets
    // cleared, as the process itself will be completely garbage collected.
    ipcMain.on("reload-process", async () => {
      // User might have changed theme, ensure the window is updated.
      this.win.setBackgroundColor(await this.getBackgroundColor());

      const crashEvent = once(this.win.webContents, "render-process-gone");
      this.win.webContents.forcefullyCrashRenderer();
      await crashEvent;

      this.win.webContents.reloadIgnoringCache();
      this.session.clearCache();
    });

    return new Promise<void>((resolve, reject) => {
      try {
        if (!isMacAppStore() && !isSnapStore()) {
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
              if (process.platform === "win32" || process.platform === "linux") {
                if (this.argvCallback != null) {
                  this.argvCallback(argv);
                }
              }
            });
          }
        }

        // This method will be called when Electron is shutting
        // down the application.
        app.on("before-quit", () => {
          this.isQuitting = true;
        });

        // This method will be called when Electron has finished
        // initialization and is ready to create browser windows.
        // Some APIs can only be used after this event occurs.
        app.on("ready", async () => {
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
          if (process.platform !== "darwin" || this.isQuitting || isMacAppStore()) {
            app.quit();
          }
        });

        app.on("activate", async () => {
          // On OS X it's common to re-create a window in the app when the
          // dock icon is clicked and there are no other windows open.
          if (this.win === null) {
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
      this.defaultHeight
    );
    this.enableAlwaysOnTop = await this.stateService.getEnableAlwaysOnTop();

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
      icon: process.platform === "linux" ? path.join(__dirname, "/images/icon.png") : undefined,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
      show: false,
      backgroundColor: await this.getBackgroundColor(),
      alwaysOnTop: this.enableAlwaysOnTop,
      webPreferences: {
        spellcheck: false,
        nodeIntegration: true,
        backgroundThrottling: false,
        contextIsolation: false,
        session: this.session,
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
    this.win.loadURL(
      url.format({
        protocol: "file:",
        pathname: path.join(__dirname, "/index.html"),
        slashes: true,
      }),
      {
        userAgent: cleanUserAgent(this.win.webContents.userAgent),
      }
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

    if (this.createWindowCallback) {
      this.createWindowCallback(this.win);
    }
  }

  // Retrieve the background color
  // Resolves background color missmatch when starting the application.
  async getBackgroundColor(): Promise<string> {
    const data: { theme?: string } = await this.storageService.get("global");
    let theme = data?.theme;

    if (theme == null || theme === "system") {
      theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }

    switch (theme) {
      case "light":
        return "#ededed";
      case "dark":
        return "#222222";
      case "nord":
        return "#3b4252";
    }
  }

  async toggleAlwaysOnTop() {
    this.enableAlwaysOnTop = !this.win.isAlwaysOnTop();
    this.win.setAlwaysOnTop(this.enableAlwaysOnTop);
    await this.stateService.setEnableAlwaysOnTop(this.enableAlwaysOnTop);
  }

  private windowStateChangeHandler(configKey: string, win: BrowserWindow) {
    global.clearTimeout(this.windowStateChangeTimer);
    this.windowStateChangeTimer = global.setTimeout(async () => {
      await this.updateWindowState(configKey, win);
    }, WindowEventHandlingDelay);
  }

  private async updateWindowState(configKey: string, win: BrowserWindow) {
    if (win == null) {
      return;
    }

    try {
      const bounds = win.getBounds();

      if (this.windowStates[configKey] == null) {
        this.windowStates[configKey] = await this.stateService.getWindow();
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

      await this.stateService.setWindow(this.windowStates[configKey]);
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async getWindowState(defaultWidth: number, defaultHeight: number) {
    const state = await this.stateService.getWindow();

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

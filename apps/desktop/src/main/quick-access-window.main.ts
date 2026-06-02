// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";
import * as url from "url";

import { app, BrowserWindow, screen, session } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { cleanUserAgent, isLinux } from "../utils";

const quickAccessWidth = 680;
const quickAccessMinHeight = 64;
const quickAccessMaxHeight = 472;

export class QuickAccessWindowMain {
  private win: BrowserWindow | null = null;
  private height = quickAccessMinHeight;
  private isHiding = false;
  private lastShownAt = 0;

  constructor(private logService: LogService) {}

  async show() {
    await this.ensureWindow();

    if (this.win == null || this.win.isDestroyed()) {
      return;
    }

    await this.ensureQuickAccessRoute();
    this.positionWindow();
    this.lastShownAt = Date.now();
    this.win.show();
    this.win.focus();
    this.send({ command: "quickAccessShown" });
  }

  async toggle() {
    if (this.isVisible()) {
      this.hide();
      return;
    }

    await this.show();
  }

  hide() {
    if (this.win == null || this.win.isDestroyed() || this.isHiding) {
      return;
    }

    this.isHiding = true;
    this.win.hide();
    this.isHiding = false;
  }

  isVisible() {
    return this.win != null && !this.win.isDestroyed() && this.win.isVisible();
  }

  dispose() {
    if (this.win == null || this.win.isDestroyed()) {
      return;
    }

    this.win.close();
    this.win = null;
  }

  send(message: Record<string, unknown>) {
    if (this.win == null || this.win.isDestroyed()) {
      return;
    }

    this.win.webContents.send("messagingService", message);
  }

  resize(height: number) {
    if (this.win == null || this.win.isDestroyed()) {
      return;
    }

    this.height = this.clampHeight(height);
    this.positionWindow();
  }

  private async ensureWindow() {
    if (this.win != null && !this.win.isDestroyed()) {
      return;
    }

    this.win = new BrowserWindow({
      width: quickAccessWidth,
      height: this.height,
      minWidth: quickAccessWidth,
      minHeight: quickAccessMinHeight,
      maxWidth: quickAccessWidth,
      maxHeight: quickAccessMaxHeight,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      hasShadow: true,
      autoHideMenuBar: true,
      title: `${app.name} Quick Access`,
      icon: isLinux() ? path.join(__dirname, "/images/icon.png") : undefined,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        spellcheck: false,
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        session: session.fromPartition("persist:bitwarden", { cache: false }),
        devTools: false,
      },
    });

    // Defensive macOS fallback in case native window controls are exposed.
    this.win.setWindowButtonVisibility?.(false);

    this.win.on("blur", () => {
      const settleDelay = Math.max(250, 1000 - (Date.now() - this.lastShownAt));

      setTimeout(() => {
        if (this.win == null || this.win.isDestroyed() || this.win.isFocused()) {
          return;
        }

        this.hide();
      }, settleDelay);
    });
    this.win.on("closed", () => {
      this.win = null;
    });

    this.win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    await this.win.loadURL(this.quickAccessUrl(), {
      userAgent: cleanUserAgent(this.win.webContents.userAgent),
    });

    this.logService.debug("Quick Access window ready.");
  }

  private async ensureQuickAccessRoute() {
    if (this.win == null || this.win.isDestroyed()) {
      return;
    }

    if (this.win.webContents.getURL().includes("#/quick-access")) {
      return;
    }

    await this.win.loadURL(this.quickAccessUrl(), {
      userAgent: cleanUserAgent(this.win.webContents.userAgent),
    });
  }

  private quickAccessUrl() {
    return url.format({
      protocol: "file:",
      pathname: path.join(__dirname, "/index.html"),
      slashes: true,
      hash: "/quick-access",
    });
  }

  private positionWindow() {
    if (this.win == null || this.win.isDestroyed()) {
      return;
    }

    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    const bounds = display.workArea;
    const x = Math.round(bounds.x + bounds.width / 2 - quickAccessWidth / 2);
    const y = Math.round(bounds.y + Math.max(bounds.height * 0.22, 120));

    this.win.setBounds({
      x,
      y,
      width: quickAccessWidth,
      height: this.height,
    });
  }

  private clampHeight(height: number) {
    return Math.min(Math.max(Math.round(height), quickAccessMinHeight), quickAccessMaxHeight);
  }
}

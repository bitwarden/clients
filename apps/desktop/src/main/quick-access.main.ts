import * as path from "path";

import { BrowserWindow, globalShortcut, ipcMain } from "electron";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "./window.main";

/**
 * FORK (klappstuhl): Quick Access spotlight (1Password-style).
 *
 * A standalone, frameless, always-on-top window summoned by a global
 * Ctrl/Cmd+Shift+Space — WITHOUT opening the main app window. The spotlight is a
 * tiny static page (apps/desktop/src/spotlight/, copied to the build output by
 * webpack's CopyWebpackPlugin); it owns no vault data.
 *
 * Data flow (all decryption stays in the existing main-window renderer):
 *
 *   spotlight  --(kls-spotlight:search)-->  main  --(kls-qa:search)-->  renderer
 *   renderer   --(kls-qa:results)------->   main  --(kls-spotlight:results)--> spotlight
 *   spotlight  --(kls-spotlight:activate)-> main  --(kls-qa:activate)--> renderer (copies)
 *
 * Security: the spotlight only ever receives display fields (title/subtitle) and
 * sends back a cipher id + an action string. Passwords/TOTP are copied by the
 * renderer via the existing CopyBridgeService — secrets never enter this process
 * or the spotlight window.
 */
export class QuickAccessMain {
  private static readonly SHORTCUT = "CommandOrControl+Shift+Space";

  private spotlightWindow: BrowserWindow | null = null;
  private ipcRegistered = false;

  constructor(
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
  ) {}

  init(): void {
    this.registerIpc();

    if (globalShortcut.isRegistered(QuickAccessMain.SHORTCUT)) {
      return;
    }

    const registered = globalShortcut.register(QuickAccessMain.SHORTCUT, () => {
      this.toggle();
    });

    if (registered) {
      this.logService.info("Quick Access shortcut registered (Ctrl/Cmd+Shift+Space).");
    } else {
      this.logService.warning("Failed to register Quick Access shortcut.");
    }
  }

  dispose(): void {
    if (globalShortcut.isRegistered(QuickAccessMain.SHORTCUT)) {
      globalShortcut.unregister(QuickAccessMain.SHORTCUT);
    }
    if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
      this.spotlightWindow.destroy();
    }
    this.spotlightWindow = null;
  }

  private toggle(): void {
    const win = this.ensureWindow();
    if (win.isVisible()) {
      win.hide();
      return;
    }
    win.center();
    win.show();
    win.focus();
    // Tell the spotlight page to reset its input/results each time it opens.
    win.webContents.send("kls-spotlight:reset");
  }

  private ensureWindow(): BrowserWindow {
    if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
      return this.spotlightWindow;
    }

    const win = new BrowserWindow({
      width: 680,
      height: 96,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      fullscreenable: false,
      minimizable: false,
      maximizable: false,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, "spotlight", "spotlight-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
      },
    });

    win.setMenuBarVisibility(false);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Close on focus loss, like a native spotlight.
    win.on("blur", () => {
      if (win.isVisible()) {
        win.hide();
      }
    });
    win.on("closed", () => {
      this.spotlightWindow = null;
    });

    void win.loadFile(path.join(__dirname, "spotlight", "spotlight.html"));

    this.spotlightWindow = win;
    return win;
  }

  private get mainWebContents() {
    const win = this.windowMain.win;
    return win != null && !win.isDestroyed() ? win.webContents : null;
  }

  private registerIpc(): void {
    if (this.ipcRegistered) {
      return;
    }
    this.ipcRegistered = true;

    // Spotlight asks the renderer to search.
    ipcMain.on("kls-spotlight:search", (_event, query: string) => {
      this.mainWebContents?.send("kls-qa:search", query);
    });

    // Renderer returns results to the spotlight.
    ipcMain.on("kls-qa:results", (_event, items: unknown) => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.webContents.send("kls-spotlight:results", items);
      }
    });

    // Spotlight activates an item; renderer performs the copy. Then close.
    ipcMain.on("kls-spotlight:activate", (_event, payload: { id: string; action: string }) => {
      this.mainWebContents?.send("kls-qa:activate", payload);
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.hide();
      }
    });

    // Spotlight requests close (Esc).
    ipcMain.on("kls-spotlight:close", () => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.hide();
      }
    });

    // Spotlight grows/shrinks with its result list.
    ipcMain.on("kls-spotlight:resize", (_event, height: number) => {
      const win = this.spotlightWindow;
      if (win == null || win.isDestroyed()) {
        return;
      }
      const [width] = win.getSize();
      const clamped = Math.max(96, Math.min(560, Math.round(height)));
      win.setSize(width, clamped, false);
    });
  }
}

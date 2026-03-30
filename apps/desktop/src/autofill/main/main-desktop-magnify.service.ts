import * as path from "path";

import { app, ipcMain, globalShortcut, BrowserWindow, screen } from "electron";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { MAGNIFY_IPC_CHANNELS } from "../models/ipc-channels";
import { MagnifyCommandRequest, MagnifyCommandResponse } from "../models/magnify-commands";

export class MainDesktopMagnifyService {
  private MAGNIFY_KEYBOARD_SHORTCUT = "CommandOrControl+Shift+Space";

  // allows only a single instance of the window to be opened regardless of how many times the hotkey to open it is pressed.
  private magnifyWindow: BrowserWindow | null = null;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {}

  async init(): Promise<void> {
    await this.registerIpcListeners();
  }

  /*
    Register various IPC listeners

    Before changing IPC, please read:
    https://www.electronjs.org/docs/latest/tutorial/ipc
  */
  async registerIpcListeners() {
    // BW render process -> main process: toggle magnify on/off
    ipcMain.on(MAGNIFY_IPC_CHANNELS.TOGGLE, async (_event, enable: boolean) => {
      if (enable) {
        await this.enableMagnify();
      } else {
        this.disableMagnify();
      }
    });

    // Magnify render process -> main process -> BW render process ->
    // main process -> Magnify render process
    ipcMain.handle(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND, (event, command) =>
      this.commandHandler(event, command),
    );

    // Close the magnify window if the main BW window is closed
    this.windowMain.win.on("closed", () => {
      this.magnifyWindow?.close();
    });
  }

  // Deregister the keyboard shortcut if registered.
  disableMagnify() {
    if (globalShortcut.isRegistered(this.MAGNIFY_KEYBOARD_SHORTCUT)) {
      globalShortcut.unregister(this.MAGNIFY_KEYBOARD_SHORTCUT);
      this.logService.debug("Magnify disabled.");
    } else {
      this.logService.debug("Magnify is not registered, implicitly disabled.");
    }
  }

  dispose() {
    ipcMain.removeAllListeners(MAGNIFY_IPC_CHANNELS.TOGGLE);
    ipcMain.removeHandler(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND);

    // Also unregister the global shortcut
    this.disableMagnify();
  }

  // Register the current keyboard shortcut if not already registered
  private async enableMagnify() {
    if (globalShortcut.isRegistered(this.MAGNIFY_KEYBOARD_SHORTCUT)) {
      this.logService.debug(
        "Magnify is already enabled with this keyboard shortcut: " + this.MAGNIFY_KEYBOARD_SHORTCUT,
      );
      return;
    }

    const result = globalShortcut.register(this.MAGNIFY_KEYBOARD_SHORTCUT, async () => {
      await this.triggerMagnify();
    });

    result
      ? this.logService.debug("Magnify enabled.")
      : this.logService.error("Failed to enable Magnify.");
  }

  private async triggerMagnify() {
    // if already open: close the window
    if (this.magnifyWindow != null && !this.magnifyWindow.isDestroyed()) {
      this.magnifyWindow.close();
      return;
    }

    // otherwise create the window
    const width = 800;
    const height = 600;

    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2);
    const y = Math.round(display.workArea.y + (display.workArea.height - height) / 2);

    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      show: false,
      alwaysOnTop: true,
      backgroundColor: "#0f172b",
      webPreferences: {
        preload: path.join(__dirname, "magnify", "preload.js"),
        sandbox: true,
        contextIsolation: true,
      },
    });

    win.on("closed", () => {
      this.magnifyWindow = null;
    });

    // emitted when the window loses focus
    win.on("blur", () => {
      win.close();
    });

    // close the window when ESC pressed
    win.webContents.on("before-input-event", (_event, input) => {
      if (input.type === "keyDown" && input.key === "Escape") {
        win.close();
      }
    });

    this.magnifyWindow = win;

    win.once("ready-to-show", () => {
      app.focus({ steal: true });
      // setVisibleOnAllWorkspaces bypasses macOS per-display focus tracking,
      // allowing the window to receive focus even on a secondary screen.
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.show();
      win.focus();
      win.setVisibleOnAllWorkspaces(false);
    });

    await win.loadFile(path.join(__dirname, "magnify", "index.html"));
  }

  /*
    Receives a command from the magnify render process, relays it
    to the BW render process, waits for the response, and returns it
    back to the magnify render process via the resolved invoke Promise.
  */
  private async commandHandler(
    _event: Electron.IpcMainInvokeEvent,
    command: MagnifyCommandRequest,
  ): Promise<MagnifyCommandResponse> {
    return new Promise<MagnifyCommandResponse>((resolve, reject) => {
      const onResponse = (
        _responseEvent: Electron.IpcMainEvent,
        response: MagnifyCommandResponse,
      ) => {
        ipcMain.removeListener(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND_RELAY_ERROR, onError);
        resolve(response);
      };

      const onError = (_responseEvent: Electron.IpcMainEvent, errorMessage: string) => {
        ipcMain.removeListener(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND_RESPONSE, onResponse);
        reject(new Error(errorMessage));
      };

      ipcMain.once(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND_RESPONSE, onResponse);
      ipcMain.once(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND_RELAY_ERROR, onError);

      this.windowMain.win.webContents.send(MAGNIFY_IPC_CHANNELS.MAGNIFY_COMMAND_RELAY, command);
    });
  }
}

import * as path from "path";

import { ipcMain, globalShortcut, BrowserWindow, screen } from "electron";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { MAGNIFY_IPC_CHANNELS } from "../models/ipc-channels";
import {
  MagnifyCommand,
  MagnifyCommandRequest,
  MagnifyCommandResponse,
} from "../models/magnify-commands";

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

    // Magnify render process -> main process: resize the magnify window
    ipcMain.on(MAGNIFY_IPC_CHANNELS.MAGNIFY_RESIZE, (_event, height: number) => {
      if (this.magnifyWindow != null && !this.magnifyWindow.isDestroyed()) {
        this.magnifyWindow.setSize(640, height, false);
      }
    });

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
    ipcMain.removeAllListeners(MAGNIFY_IPC_CHANNELS.MAGNIFY_RESIZE);

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

    // otherwise: create the window
    const win = new BrowserWindow({
      width: 640,
      height: 56,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
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

    await win.loadFile(path.join(__dirname, "magnify", "index.html"));

    // Position magnify window after loading to ensure it's properly rendered
    this.positionMagnifyWindow(win);
  }

  /*
    Position the magnify window at the center of the display where the mouse cursor is.
    This is more reliable than checking focused windows since the global shortcut can
    shift focus to the Bitwarden window.
  */
  private positionMagnifyWindow(win: BrowserWindow) {
    // Get the display where the mouse cursor is currently located
    const mousePoint = screen.getCursorScreenPoint();
    const targetDisplay = screen.getDisplayNearestPoint(mousePoint);

    // Center the 640px wide magnify window at the center of that display
    const x = targetDisplay.bounds.x + (targetDisplay.bounds.width - 640) / 2;
    const y = targetDisplay.bounds.y + (targetDisplay.bounds.height - 56) / 2;

    win.setPosition(Math.round(x), Math.round(y));
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
    }).then((response) => {
      if (command.type === MagnifyCommand.ViewInBitwarden) {
        this.magnifyWindow?.close();
        this.windowMain.win.show();
      }
      return response;
    });
  }
}

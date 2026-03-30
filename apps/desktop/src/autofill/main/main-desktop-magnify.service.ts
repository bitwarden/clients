import * as path from "path";

import { ipcMain, globalShortcut, BrowserWindow } from "electron";

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
      await this.openMagnify();
    });

    result
      ? this.logService.debug("Magnify enabled.")
      : this.logService.error("Failed to enable Magnify.");
  }

  // Open the magnify window, which is its own project
  private async openMagnify() {
    // surface the existing window if the window has already been created
    if (this.magnifyWindow != null && !this.magnifyWindow.isDestroyed()) {
      this.magnifyWindow.focus();
      return;
    }

    // otherwise create the window
    const win = new BrowserWindow({
      width: 800,
      height: 600,
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

    this.magnifyWindow = win;

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

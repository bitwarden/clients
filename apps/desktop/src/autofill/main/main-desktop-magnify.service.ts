import * as path from "path";

import { ipcMain, globalShortcut, BrowserWindow } from "electron";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { MAGNIFY_IPC_CHANNELS } from "../models/ipc-channels";
import { MagnifyCommandRequest, MagnifyCommandResponse } from "../models/magnify-commands";

export class MainDesktopMagnifyService {
  private MAGNIFY_KEYBOARD_SHORTCUT = "CommandOrControl+Shift+Space";

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {}

  async init(): Promise<void> {
    await this.registerIpcListeners();
  }

  /*
    Register various IPC listeners

    https://www.electronjs.org/docs/latest/tutorial/ipc
  */
  async registerIpcListeners() {
    // From bw render process -> main process, 1 way Electron IPC
    ipcMain.on(MAGNIFY_IPC_CHANNELS.TOGGLE, async (_event, enable: boolean) => {
      if (enable) {
        await this.enableMagnify();
      } else {
        this.disableMagnify();
      }
    });

    // From
    ipcMain.on(
      MAGNIFY_IPC_CHANNELS.MAIN_PROCESS_COMMANDS_FROM_BW_LISTENER,
      (_event, response: MagnifyCommandResponse) => {
        // eslint-disable-next-line no-console
        console.log("FROM THE MAIN DESKTOP MAGNIFY PROCESS");
        // eslint-disable-next-line no-console
        console.log("RECEIVED THE: MagnifyCommandResponse");
        // eslint-disable-next-line no-console
        console.log(response);

        /*
        // this needs to be sent to the magnify window
        this.windowMain.win.webContents.send(
          MAGNIFY_IPC_CHANNELS.BW_RENDER_PROCESS_COMMANDS_FROM_MAIN_PROCESS_LISTENER,
          command,
        );
         */
      },
    );

    // From magnify render process -> main process
    ipcMain.handle(
      MAGNIFY_IPC_CHANNELS.MAIN_PROCESS_COMMANDS_FROM_MAGNIFY_LISTENER,
      (event, command) => this.commandHandler(event, command),
    );
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
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "magnify", "preload.js"),
        sandbox: true,
        contextIsolation: true,
      },
    });

    await win.loadFile(path.join(__dirname, "magnify", "index.html"));
  }

  /*
    commandHandler() sends Magnify commands from the Magnify render process
    to the Bitwarden render process.
  */
  private async commandHandler(
    _event: Electron.IpcMainInvokeEvent,
    command: MagnifyCommandRequest,
  ) {
    // eslint-disable-next-line no-console
    console.log("HIT COMMAND HANDLER");
    this.windowMain.win.webContents.send(
      MAGNIFY_IPC_CHANNELS.BW_RENDER_PROCESS_COMMANDS_FROM_MAIN_PROCESS_LISTENER,
      command,
    );
  }
}

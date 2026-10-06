// MVP, delete with PM-41067

import { ipcMain, globalShortcut } from "electron";

import { autotype_mvp } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { stringIsNotUndefinedNullAndEmpty } from "../../utils";
import { AutotypeConfig } from "../models/autotype-config";
import { AutotypeMatchError } from "../models/autotype-errors";
import { AutotypeVaultData } from "../models/autotype-vault-data";
import { AUTOTYPE_MVP_IPC_CHANNELS } from "../models/ipc-channels";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

export class MainDesktopAutotypeMvpService {
  private autotypeKeyboardShortcut: AutotypeKeyboardShortcut;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();

    this.registerIpcListeners();
  }

  registerIpcListeners() {
    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE, (_event, enable: boolean) => {
      if (enable) {
        this.enableAutotype();
      } else {
        this.disableAutotype();
      }
    });

    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE, (_event, config: AutotypeConfig) => {
      const newKeyboardShortcut = new AutotypeKeyboardShortcut();
      const newKeyboardShortcutIsValid = newKeyboardShortcut.set(config.keyboardShortcut);

      if (!newKeyboardShortcutIsValid) {
        this.logService.error("Configure autotype failed: the keyboard shortcut is invalid.");
        return;
      }

      this.setKeyboardShortcut(newKeyboardShortcut);
    });

    ipcMain.on(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE, (_event, vaultData: AutotypeVaultData) => {
      if (
        stringIsNotUndefinedNullAndEmpty(vaultData.username) &&
        stringIsNotUndefinedNullAndEmpty(vaultData.password)
      ) {
        this.doAutotype(vaultData, this.autotypeKeyboardShortcut.getArrayFormat());
      }
    });

    ipcMain.on(
      AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR,
      (_event, matchError: AutotypeMatchError) => {
        this.logService.debug(
          AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR,
          "No match for window: " + matchError.windowTitle,
        );
        this.logService.error(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR, matchError.errorMessage);
      },
    );
  }

  // Deregister the keyboard shortcut if registered.
  disableAutotype() {
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();

    if (globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      globalShortcut.unregister(formattedKeyboardShortcut);
      this.logService.debug("Autotype disabled.");
    } else {
      this.logService.debug("Autotype is not registered, implicitly disabled.");
    }
  }

  dispose() {
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.TOGGLE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.CONFIGURE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTE);
    ipcMain.removeAllListeners(AUTOTYPE_MVP_IPC_CHANNELS.EXECUTION_ERROR);

    // Also unregister the global shortcut
    this.disableAutotype();
  }

  // Register the current keyboard shortcut if not already registered.
  private enableAutotype() {
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();
    if (globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      this.logService.debug(
        "Autotype is already enabled with this keyboard shortcut: " + formattedKeyboardShortcut,
      );
      return;
    }

    const result = globalShortcut.register(
      this.autotypeKeyboardShortcut.getElectronFormat(),
      () => {
        if (this.windowMain.win != null && !this.windowMain.win.isDestroyed()) {
          const windowTitle = autotype_mvp.getForegroundWindowTitle();

          this.windowMain.win.webContents.send(AUTOTYPE_MVP_IPC_CHANNELS.LISTEN, {
            windowTitle,
          });
        } else {
          this.logService.debug(
            "Autotype keyboard shortcut activated, but the main window does not exist.",
          );
        }
      },
    );

    result
      ? this.logService.debug("Autotype enabled.")
      : this.logService.error("Failed to enable Autotype.");
  }

  // Set the keyboard shortcut if it differs from the present one. If
  // the keyboard shortcut is set, de-register the old shortcut first.
  private setKeyboardShortcut(keyboardShortcut: AutotypeKeyboardShortcut) {
    if (
      keyboardShortcut.getElectronFormat() !== this.autotypeKeyboardShortcut.getElectronFormat()
    ) {
      const registered = globalShortcut.isRegistered(
        this.autotypeKeyboardShortcut.getElectronFormat(),
      );
      if (registered) {
        this.disableAutotype();
      }
      this.autotypeKeyboardShortcut = keyboardShortcut;
      if (registered) {
        this.enableAutotype();
      }
    } else {
      this.logService.debug(
        "setKeyboardShortcut() called but shortcut is not different from current.",
      );
    }
  }

  private doAutotype(vaultData: AutotypeVaultData, keyboardShortcut: string[]) {
    const TAB = "\t";
    const inputPattern = vaultData.username + TAB + vaultData.password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype_mvp.typeInput(inputArray, keyboardShortcut);
  }
}

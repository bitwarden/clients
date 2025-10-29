import { ipcMain, globalShortcut } from "electron";

import { autotype } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { stringIsNotUndefinedNullAndEmpty } from "../../utils";
import { AutotypeVaultData } from "../models/autotype-vault-data";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

export class MainDesktopAutotypeService {
  autotypeKeyboardShortcut: AutotypeKeyboardShortcut;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();
  }

  init() {
    ipcMain.on("autofill.configureAutotype", (event, data) => {
      if (data.enabled) {
        const newKeyboardShortcut = new AutotypeKeyboardShortcut();
        const newKeyboardShortcutIsValid = newKeyboardShortcut.set(data.keyboardShortcut);

        if (newKeyboardShortcutIsValid) {
          this.disableAutotype();
          this.autotypeKeyboardShortcut = newKeyboardShortcut;
          this.enableAutotype();
        } else {
          this.logService.error(
            "Attempting to configure autotype but the shortcut given is invalid.",
          );
        }
      } else {
        this.disableAutotype();

        // Deregister the incoming keyboard shortcut if needed
        const setCorrectly = this.autotypeKeyboardShortcut.set(data.keyboardShortcut);
        if (
          setCorrectly &&
          globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())
        ) {
          globalShortcut.unregister(this.autotypeKeyboardShortcut.getElectronFormat());
          this.logService.info("Autotype disabled.");
        }
      }
    });

    ipcMain.on("autofill.completeAutotypeRequest", (_event, vaultData: AutotypeVaultData) => {
      if (
        stringIsNotUndefinedNullAndEmpty(vaultData.username) &&
        stringIsNotUndefinedNullAndEmpty(vaultData.password)
      ) {
        this.doAutotype(vaultData, this.autotypeKeyboardShortcut.getArrayFormat());
      }
    });
  }

  disableAutotype() {
    // Deregister the current keyboard shortcut if needed
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();
    if (globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      globalShortcut.unregister(formattedKeyboardShortcut);
      this.logService.info("Autotype disabled.");
    }
  }

  private enableAutotype() {
    const result = globalShortcut.register(
      this.autotypeKeyboardShortcut.getElectronFormat(),
      () => {
        const windowTitle = autotype.getForegroundWindowTitle();

        this.windowMain.win.webContents.send("autofill.listenAutotypeRequest", {
          windowTitle,
        });
      },
    );

    result
      ? this.logService.info("Autotype enabled.")
      : this.logService.info("Enabling autotype failed.");
  }

  private doAutotype(vaultData: AutotypeVaultData, keyboardShortcut: string[]) {
    const inputPattern = vaultData.username + "\t" + vaultData.password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype.typeInput(inputArray, keyboardShortcut);
  }
}

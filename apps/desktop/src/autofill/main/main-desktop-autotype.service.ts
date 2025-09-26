import { ipcMain, globalShortcut } from "electron";

import { autotype } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { stringIsNotUndefinedNullAndEmpty } from "../../utils";
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
      console.log("autofill.configureAutotype hit in the main process");

      if (data.enabled) {
        const newKeyboardShortcut = new AutotypeKeyboardShortcut();
        const newKeyboardShortcutIsValid = newKeyboardShortcut.set(data.keyboardShortcut);

        if (newKeyboardShortcutIsValid) {
          // Deregister the current keyboard shortcut if needed
          if (globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())) {
            globalShortcut.unregister(this.autotypeKeyboardShortcut.getElectronFormat());
          }

          this.autotypeKeyboardShortcut = newKeyboardShortcut;
          this.enableAutotype();
        } else if (!newKeyboardShortcutIsValid) {
          // TODO
          // Autotype is enabled and the new shortcut is invalid
          // Send an error back to the render process
        }
      } else {
        // Deregister the current keyboard shortcut if needed
        if (globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())) {
          globalShortcut.unregister(this.autotypeKeyboardShortcut.getElectronFormat());
        }

        // Deregister the incoming keyboard shortcut if needed
        if (
          this.autotypeKeyboardShortcut.set(data.keyboardShortcut) &&
          globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())
        ) {
          globalShortcut.unregister(this.autotypeKeyboardShortcut.getElectronFormat());
        }

        this.logService.info("Autotype disabled.");
      }
    });

    ipcMain.on("autofill.completeAutotypeRequest", (event, data) => {
      const { response } = data;

      if (
        stringIsNotUndefinedNullAndEmpty(response.username) &&
        stringIsNotUndefinedNullAndEmpty(response.password)
      ) {
        this.doAutotype(
          response.username,
          response.password,
          this.autotypeKeyboardShortcut.getArrayFormat(),
        );
      }
    });
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

  private doAutotype(username: string, password: string, keyboardShortcut: string[]) {
    const inputPattern = username + "\t" + password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype.typeInput(inputArray, keyboardShortcut);
  }
}

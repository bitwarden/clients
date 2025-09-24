import { ipcMain, globalShortcut } from "electron";

import { autotype } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut"
import { WindowMain } from "../../main/window.main";
import { stringIsNotUndefinedNullAndEmpty } from "../../utils";

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
      console.log("3: autofill.configureAutotype hit in the main process");

      let setCorrectly = this.autotypeKeyboardShortcut.set(data.keyboardShortcut);
      console.log("Was autotypeKeyboardShortcut set correctly from within the main process? " + setCorrectly);
      // TODO: What do we do if it wasn't? The value won't change but we need to send a failure message back

      if (data.enabled === true && !globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())) {
        this.enableAutotype();
      } else if (data.enabled === false && globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())) {
        this.disableAutotype();
      }
    });

    ipcMain.on("autofill.completeAutotypeRequest", (event, data) => {
      const { response } = data;

      if (
        stringIsNotUndefinedNullAndEmpty(response.username) &&
        stringIsNotUndefinedNullAndEmpty(response.password)
      ) {
        this.doAutotype(response.username, response.password, this.autotypeKeyboardShortcut.getArrayFormat());
      }
    });
  }

  disableAutotype() {
    if (globalShortcut.isRegistered(this.autotypeKeyboardShortcut.getElectronFormat())) {
      globalShortcut.unregister(this.autotypeKeyboardShortcut.getElectronFormat());
    }

    this.logService.info("Autotype disabled.");
  }

  private enableAutotype() {
    const result = globalShortcut.register(this.autotypeKeyboardShortcut.getElectronFormat(), () => {
      const windowTitle = autotype.getForegroundWindowTitle();

      this.windowMain.win.webContents.send("autofill.listenAutotypeRequest", {
        windowTitle,
      });
    });

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

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
    console.log("main-desktop-autotype::constructor()");
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();

    ipcMain.handle("autofill.initAutotype", async (event: any, data: any) => {
      console.log("main-desktop-autotype::constructor-> handle autofill.initAutotype()");
      this.init();
    });
  }

  init() {
    console.log("main-desktop-autotype::init()");
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
      } else if (this.autotypeKeyboardShortcut.set(data.keyboardShortcut)) {
        // Deregister the incoming keyboard shortcut if set
        this.disableAutotype();
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

  // Deregister the current keyboard shortcut if registered
  disableAutotype() {
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

  private doAutotype(username: string, password: string, keyboardShortcut: string[]) {
    const inputPattern = username + "\t" + password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype.typeInput(inputArray, keyboardShortcut);
  }
}

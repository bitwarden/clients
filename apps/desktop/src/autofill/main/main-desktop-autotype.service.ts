import { ipcMain, globalShortcut } from "electron";

import { autotype } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { stringIsNotUndefinedNullAndEmpty } from "../../utils";

export class MainDesktopAutotypeService {
  keySequence: string = "Alt+CommandOrControl+I";

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {}

  init() {
    ipcMain.on("autofill.configureAutotype", (event, data) => {
      if (data.enabled === true && !globalShortcut.isRegistered(this.keySequence)) {
        this.enableAutotype();
      } else if (data.enabled === false && globalShortcut.isRegistered(this.keySequence)) {
        this.disableAutotype();
      }
    });

    ipcMain.on("autofill.completeAutotypeRequest", (event, data) => {
      const { response } = data;

      if (
        stringIsNotUndefinedNullAndEmpty(response.username) &&
        stringIsNotUndefinedNullAndEmpty(response.password)
      ) {
        this.doAutotype(response.username, response.password);
      }
    });
  }

  disableAutotype() {
    if (globalShortcut.isRegistered(this.keySequence)) {
      globalShortcut.unregister(this.keySequence);
    }

    this.logService.info("Autotype disabled.");
  }

  private enableAutotype() {
    const result = globalShortcut.register(this.keySequence, () => {
      const windowTitle = autotype.getForegroundWindowTitle();

      this.windowMain.win.webContents.send("autofill.listenAutotypeRequest", {
        windowTitle,
      });
    });

    result
      ? this.logService.info("Autotype enabled.")
      : this.logService.info("Enabling autotype failed.");
  }

  private doAutotype(username: string, password: string) {
    const inputPattern = username + "\t" + password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype.typeInput(inputArray);
  }
}

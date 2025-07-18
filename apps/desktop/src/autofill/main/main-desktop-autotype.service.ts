import { ipcMain } from "electron";

import { globalShortcut } from "electron";

import { autotype } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { LogService } from "@bitwarden/logging";

export class MainDesktopAutotypeService {
  keySequence: string = "Alt+CommandOrControl+I";

  constructor(private logService: LogService, private windowMain: WindowMain,) {}

  init() {
    // this.desktopAutotypeService.autotypeEnabled$.subscribe((enabled) => {
    //   if (enabled) {
    //     this.enableAutotype();
    //   } else {
    //     this.disableAutotype();
    //   }
    // });

    ipcMain.on("autofill.configureAutotype", (event, data) => {
      if (data.enabled) {
        this.enableAutotype();
      } else {
        this.disableAutotype();
      }
    });

    ipcMain.on("autofill.completeAutotypeRequest", (event, data) => {
      const { username, password } = data;
      console.log("username: " + username + "\npassword: " + password);

      let inputString = "";
      autotype.typeInput(new Array<number>());
    });
  }

  private enableAutotype() {
    // eslint-disable-next-line no-console
    console.log("Enabling Autotype...");

    const result = globalShortcut.register(this.keySequence, () => {
      this.doAutotype();
    });

    // eslint-disable-next-line no-console
    console.log("enable autotype shortcut result: " + result);
  }

  private disableAutotype() {
    // eslint-disable-next-line no-console
    console.log("Disabling Autotype...");
  }

  private doAutotype() {
    const windowTitle = autotype.getForegroundWindowTitle();
    // eslint-disable-next-line no-console
    console.log("Window Title: " + windowTitle);

    this.windowMain.win.webContents.send("autofill.listenAutotypeRequest", {
      windowTitle,
    });

    // --------------------------------------------------
    // 1. ipc main <-> render
    // 2. encoding to utf16 for Array<number>

    //const result = autotype.typeInput(new Array<number>());
    // eslint-disable-next-line no-console
    //console.log("Type Input: " + result);
  }
}

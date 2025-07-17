import { globalShortcut } from "electron";

import { autotype } from "@bitwarden/desktop-napi";

import { DesktopAutotypeService } from "../services/desktop-autotype.service";

export class MainDesktopAutotypeService {
  keySequence: string = "Alt+CommandOrControl+I";

  constructor(private desktopAutotypeService: DesktopAutotypeService) {}

  init() {
    this.desktopAutotypeService.autotypeEnabled$.subscribe((enabled) => {
      if (enabled) {
        this.enableAutotype();
      } else {
        this.disableAutotype();
      }
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
    const window_title = autotype.getForegroundWindowTitle();
    // eslint-disable-next-line no-console
    console.log("Window Title: " + window_title);

    // --------------------------------------------------

    const result = autotype.typeInput(new Array<number>());
    // eslint-disable-next-line no-console
    console.log("Window Title: " + result);
  }
}

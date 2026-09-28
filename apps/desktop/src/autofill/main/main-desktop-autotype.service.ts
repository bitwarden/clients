import { globalShortcut } from "electron";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

export class MainDesktopAutotypeService {
  private autotypeKeyboardShortcut: AutotypeKeyboardShortcut;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();
  }

  // Enabling Autotype will:
  //   - Register the keyboard shortcut, if it's not registered
  //   - Define the function that executes the Autotype when the
  //     keyboard shortcut is pressed (if the keyboard shortcut isn't registered already)
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
          // TODO: For Autotype GA, from this location, we need to...
          //   - Get the autotype app data for the currently focused application
          //     (multiple tickets, culminates in PM-38921)
          //   - Send this app data to the render process via encrypted IPC for
          //     the Autotype Verification Flow (PM-38967)
          //   - If the Verification Flow passes, we need to execute Autotype
          //     (multiple tickets, culminates in PM-38921), with the following
          //     caveats:
          //     - Show the confirmation dialog, if it should be shown (PM-38917)
          //     - Verify the window is the same (PM-38968)
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

  // Disabling Autotype will:
  //   - Deregister the keyboard shortcut, if it's registered
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
    // Disable Autotype
    this.disableAutotype();
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
}

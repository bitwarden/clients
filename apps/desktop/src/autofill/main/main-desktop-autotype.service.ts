import { globalShortcut } from "electron";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import { autotypeRegisterSetEnabledHandler } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { AutotypeSetEnabledDriver } from "../ipc-drivers/autotype-set-enabled-driver";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

export class MainDesktopAutotypeService {
  private autotypeKeyboardShortcut: AutotypeKeyboardShortcut;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
    private ipcService: IpcService,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();
  }

  async init() {
    // Attempt to register the Autotype SetEnabledHandler
    try {
      await autotypeRegisterSetEnabledHandler(
        this.ipcService.client,
        new AutotypeSetEnabledDriver(this, this.logService),
      );
    } catch (e) {
      this.logService.error("Failed to register the Autotype set-enabled IPC handler.", e);
    }
  }

  // Apply the requested enabled state, returning whether it was applied.
  setAutotypeEnabled(enabled: boolean): boolean {
    return enabled ? this.enableAutotype() : this.disableAutotype();
  }

  // Enabling Autotype will:
  //   - Register the keyboard shortcut, if it's not registered
  //   - Define the function that executes the Autotype when the
  //     keyboard shortcut is pressed (if the keyboard shortcut isn't registered already)
  // Returns:
  //   - If Autotype was enabled successfully or not
  private enableAutotype(): boolean {
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();
    if (globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      this.logService.debug(
        "Autotype is already enabled with this keyboard shortcut: " + formattedKeyboardShortcut,
      );

      return true;
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

    return result;
  }

  // Disabling Autotype will:
  //   - Deregister the keyboard shortcut, if it's registered
  //
  // Returns:
  //   - If disabling Autotype was successful (is currently always true)
  disableAutotype(): boolean {
    const formattedKeyboardShortcut = this.autotypeKeyboardShortcut.getElectronFormat();

    if (globalShortcut.isRegistered(formattedKeyboardShortcut)) {
      globalShortcut.unregister(formattedKeyboardShortcut);
      this.logService.debug("Autotype disabled.");
    } else {
      this.logService.debug("Autotype is not registered, implicitly disabled.");
    }

    return true;
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

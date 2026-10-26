import { globalShortcut } from "electron";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import {
  AutotypeDriver,
  AutotypeRunningApp,
  registerAutotypeHandlers,
} from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

/**
 * SDK driver for the Autotype IPC channels. This is responsible for applying the
 * render process's Autotype requests, received over encrypted IPC, in the main process.
 *
 * The method names are snake_case because they implement the SDK's `AutotypeDriver` interface.
 */
class MainAutotypeDriver implements AutotypeDriver {
  constructor(private autotypeService: MainDesktopAutotypeService) {}

  async set_autotype_enabled(enabled: boolean): Promise<boolean> {
    return this.autotypeService.setAutotypeEnabled(enabled);
  }

  // The keyboard shortcut channel is not wired up yet (PM-38967), so no shortcut is applied.
  async set_autotype_keyboard_shortcut(_shortcut: string[]): Promise<boolean> {
    return false;
  }

  // The running apps channel is not wired up yet, so no apps are reported.
  async list_running_apps(): Promise<AutotypeRunningApp[]> {
    return [];
  }
}

export class MainDesktopAutotypeService {
  private autotypeKeyboardShortcut: AutotypeKeyboardShortcut;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
    private ipcService: IpcService,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();
  }

  // Registers the handlers that respond to the render process's Autotype
  // requests. Must be called after the IPC service is initialized.
  async init() {
    try {
      await registerAutotypeHandlers(this.ipcService.client, new MainAutotypeDriver(this));
    } catch (e) {
      this.logService.error("Failed to register the Autotype IPC handlers.", e);
    }
  }

  // Enables or disables Autotype.
  // Returns:
  //   - If the requested enabled state was applied or not
  setAutotypeEnabled(enabled: boolean): boolean {
    return enabled ? this.enableAutotype() : this.disableAutotype();
  }

  // Enabling Autotype will:
  //   - Register the keyboard shortcut, if it's not registered
  //   - Define the function that executes the Autotype when the
  //     keyboard shortcut is pressed (if the keyboard shortcut isn't registered already)
  // Returns:
  //   - If Autotype is enabled or not
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
  // Returns:
  //   - If Autotype is disabled (currently always true)
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

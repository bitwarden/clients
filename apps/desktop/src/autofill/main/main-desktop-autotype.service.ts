import { globalShortcut } from "electron";

import { IpcService } from "@bitwarden/common/platform/ipc";
import { autotype_mvp } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";
import {
  AutotypeEchoResponse,
  autotypeRegisterEchoHandler,
  autotypeRequestEcho,
} from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { AutotypeVaultData } from "../models/autotype-vault-data";
import { AutotypeKeyboardShortcut } from "../models/main-autotype-keyboard-shortcut";

// Matches DISCOVER_MESSAGE_TIMEOUT_MS used by the browser's desktop IPC transport.
const AUTOTYPE_ECHO_TIMEOUT_MS = 5_000;

export class MainDesktopAutotypeService {
  private autotypeKeyboardShortcut: AutotypeKeyboardShortcut;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
    private ipcService: IpcService,
  ) {
    this.autotypeKeyboardShortcut = new AutotypeKeyboardShortcut();

    this.registerIpcListeners();
  }

  async init() {
    await autotypeRegisterEchoHandler(this.ipcService.client);
  }

  /**
   * Sends an autotype echo request to the renderer process over the
   * Noise-encrypted SDK IPC channel.
   *
   * Do not call this from {@link init} — the renderer registers its handler much
   * later (from `init.service.ts`, once Angular has booted), so a request issued
   * during main-process startup will time out. The real trigger is the autotype
   * keyboard shortcut, which is wired up separately.
   *
   * Rejections are intentionally propagated: a caller needs to know the renderer
   * did not answer.
   */
  async requestEcho(message: string): Promise<AutotypeEchoResponse> {
    return await autotypeRequestEcho(
      this.ipcService.client,
      "DesktopRenderer",
      message,
      AbortSignal.timeout(AUTOTYPE_ECHO_TIMEOUT_MS),
    );
  }

  registerIpcListeners() {
    // none yet
  }

  // Deregister the keyboard shortcut if registered.
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
    // Unregister the global shortcut
    this.disableAutotype();
  }

  // Register the current keyboard shortcut if not already registered.
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
          // TODO: send the foreground window title to the renderer over the
          // encrypted IPC channel via requestEcho's successor, once the real
          // autotype request type exists.
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

  private doAutotype(vaultData: AutotypeVaultData, keyboardShortcut: string[]) {
    const TAB = "\t";
    const inputPattern = vaultData.username + TAB + vaultData.password;
    const inputArray = new Array<number>(inputPattern.length);

    for (let i = 0; i < inputPattern.length; i++) {
      inputArray[i] = inputPattern.charCodeAt(i);
    }

    autotype_mvp.typeInput(inputArray, keyboardShortcut);
  }
}

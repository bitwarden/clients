import { globalShortcut } from "electron";

import { MessageSender } from "@bitwarden/common/platform/messaging";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "./window.main";

/**
 * FORK (klappstuhl): Quick Access spotlight.
 *
 * Registers a global Ctrl/Cmd+Shift+K shortcut (1Password-style). When pressed,
 * the main window is restored/focused and an "openQuickAccess" message is
 * broadcast to the renderer, where the redesign shell opens the command palette.
 *
 * Security: this only summons the existing (already-authenticated) window and
 * the existing palette. It never reads, decrypts, or transmits vault data
 * itself — all of that stays in the renderer behind the unlock state.
 */
export class QuickAccessMain {
  private static readonly SHORTCUT = "CommandOrControl+Shift+K";

  constructor(
    private readonly windowMain: WindowMain,
    private readonly messagingService: MessageSender,
    private readonly logService: LogService,
  ) {}

  init(): void {
    if (globalShortcut.isRegistered(QuickAccessMain.SHORTCUT)) {
      return;
    }

    const registered = globalShortcut.register(QuickAccessMain.SHORTCUT, () => {
      this.summon();
    });

    if (registered) {
      this.logService.info("Quick Access shortcut registered (Ctrl/Cmd+Shift+K).");
    } else {
      this.logService.warning("Failed to register Quick Access shortcut.");
    }
  }

  dispose(): void {
    if (globalShortcut.isRegistered(QuickAccessMain.SHORTCUT)) {
      globalShortcut.unregister(QuickAccessMain.SHORTCUT);
    }
  }

  private summon(): void {
    const win = this.windowMain.win;
    if (win == null) {
      return;
    }

    if (win.isMinimized()) {
      win.restore();
    }
    if (!win.isVisible()) {
      win.show();
    }
    win.focus();

    this.messagingService.send("openQuickAccess");
  }
}

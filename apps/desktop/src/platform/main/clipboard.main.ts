import { app, ipcMain } from "electron";
import { firstValueFrom } from "rxjs";

import { ClearClipboardDelay } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@bitwarden/common/autofill/types";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { clipboards } from "@bitwarden/desktop-napi";

import { ClipboardWriteMessage } from "../types/clipboard";

/**
 * Owns the clipboard end to end: the OS read/write, and the delayed clear after copying a secret.
 * Scheduling the clear here, rather than leaving it to the renderer's own timer, means a copied
 * secret still gets cleared on schedule even if the renderer is destroyed or never starts. Only
 * one of the two may own the timer, so main schedules nothing while the renderer still does.
 */
export class ClipboardMain {
  lastSavedValue: string | null = null;
  private clearTimeout?: NodeJS.Timeout;

  constructor(
    private readonly flagEnabled: boolean,
    private readonly autofillSettingsService: AutofillSettingsServiceAbstraction,
  ) {}

  init() {
    app.on("before-quit", async () => {
      await this.clearIfUnchanged();
    });

    ipcMain.handle("clipboard.read", async (_event: any, _message: any) => {
      return await clipboards.read();
    });

    ipcMain.handle("clipboard.write", async (_event: any, message: ClipboardWriteMessage) => {
      this.lastSavedValue = message.text;
      const result = await clipboards.write(message.text, message.password ?? false);
      await this.scheduleClear(message.clearMs ?? null);
      return result;
    });

    // Lets the renderer run the pending clear immediately, e.g. on lock or logout, instead of
    // waiting out the delay.
    ipcMain.handle("clipboard.clearNow", async () => {
      await this.clearNow();
    });
  }

  /** Runs the pending scheduled clear now, if there is one. */
  async clearNow(): Promise<void> {
    if (this.clearTimeout == null) {
      return;
    }

    this.cancelScheduledClear();
    await this.clearIfUnchanged();
  }

  /**
   * Clears any previously scheduled clear, then schedules one for the value just written. Does
   * nothing while the renderer owns the timer, which schedules its own.
   */
  private async scheduleClear(clearMsOverride: number | null): Promise<void> {
    this.cancelScheduledClear();

    if (!this.flagEnabled) {
      return;
    }

    if (Utils.isNullOrWhitespace(this.lastSavedValue)) {
      return;
    }

    let delayMs = clearMsOverride;
    if (delayMs == null) {
      const delaySetting = await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);
      delayMs = ClipboardMain.clearClipboardDelayToMs(delaySetting);
    }
    if (delayMs == null) {
      return;
    }

    this.clearTimeout = setTimeout(() => {
      this.clearTimeout = undefined;
      this.clearIfUnchanged().catch(() => {
        // Best effort: a failed clear here is no worse than the clipboard keeping its value.
      });
    }, delayMs);
  }

  /**
   * Clears the clipboard if it still holds the last value Bitwarden wrote. Used by the scheduled
   * clear, {@link clearNow}, and on quit.
   */
  async clearIfUnchanged(): Promise<void> {
    if (this.lastSavedValue == null) {
      return;
    }

    const clipboardNow = await clipboards.read();
    if (clipboardNow == this.lastSavedValue) {
      await clipboards.write("", false);
      this.lastSavedValue = null;
    }
  }

  private cancelScheduledClear(): void {
    if (this.clearTimeout != null) {
      clearTimeout(this.clearTimeout);
      this.clearTimeout = undefined;
    }
  }

  private static clearClipboardDelayToMs(setting: ClearClipboardDelaySetting): number | null {
    switch (setting) {
      case ClearClipboardDelay.Never:
        return null;
      case ClearClipboardDelay.TenSeconds:
        return 10 * 1000;
      case ClearClipboardDelay.TwentySeconds:
        return 20 * 1000;
      case ClearClipboardDelay.ThirtySeconds:
        return 30 * 1000;
      case ClearClipboardDelay.OneMinute:
        return 60 * 1000;
      case ClearClipboardDelay.TwoMinutes:
        return 120 * 1000;
      case ClearClipboardDelay.FiveMinutes:
        return 300 * 1000;
      default:
        return 300 * 1000; // Default to 5 minutes
    }
  }
}

import { DOCUMENT, inject, Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

/**
 * Routes `<input type="file">` through the main process's file dialog.
 *
 * On Linux builds with process isolation, xdg-desktop-portal cannot identify the isolated
 * process and refuses Chromium's portal-backed file chooser, so the main process turns the
 * portal off for file dialogs. Electron applies that only to its own `dialog` API, not to the
 * `<input type="file">` path, so this service intercepts file-input clicks and asks the main
 * process (`FilePickerMain`) to show the dialog. The chosen files are handed back to the input
 * through a `change` event, so components such as `bit-file-upload` keep working unchanged.
 *
 * Does nothing unless the main process reports the bypass as active.
 */
@Injectable()
export class NativeFilePickerService {
  private readonly document = inject(DOCUMENT);
  private readonly logService = inject(LogService);

  async init(): Promise<void> {
    let enabled = false;
    try {
      enabled = await ipc.platform.filePicker.isEnabled();
    } catch (e) {
      // A broken file picker must not block app startup; the native input keeps working.
      this.logService.error("[NativeFilePicker] Could not query the main process", e);
    }
    if (!enabled) {
      return;
    }
    // Capture phase: runs before the input's own activation behavior, which opens the picker.
    this.document.addEventListener("click", (event) => this.onClick(event), { capture: true });
  }

  private onClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "file" || target.disabled) {
      return;
    }
    event.preventDefault();
    void this.pickInto(target);
  }

  private async pickInto(input: HTMLInputElement): Promise<void> {
    try {
      const picked = await ipc.platform.filePicker.pickFiles({
        multiple: input.multiple,
        accept: input.accept,
      });
      if (picked == null || picked.length === 0) {
        return; // Cancelled. A native dialog leaves the input untouched too.
      }
      const transfer = new DataTransfer();
      for (const file of picked) {
        transfer.items.add(new File([file.data], file.name));
      }
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      this.logService.error("[NativeFilePicker] Failed to pick files", e);
    }
  }
}

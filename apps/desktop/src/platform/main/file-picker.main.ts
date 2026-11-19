import * as fs from "fs";
import * as path from "path";

import {
  BrowserWindow,
  dialog,
  FileFilter,
  ipcMain,
  IpcMainInvokeEvent,
  OpenDialogOptions,
} from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { shouldBypassXdgPortalFileDialogs } from "../../main/window.main";
import { PickedFile, PickFilesOptions } from "../types/file-picker";

/**
 * Shows file-open dialogs on behalf of the renderer.
 *
 * Used only where {@link shouldBypassXdgPortalFileDialogs} is true. There the main process
 * disables Chromium's portal-backed file dialogs (`--xdg-portal-required-version`), but Electron
 * applies that switch to its own `dialog` API only, not to Chromium's `<input type="file">`
 * path. So the renderer intercepts file-input clicks (`NativeFilePickerService`) and asks this
 * class to show the dialog instead.
 *
 * Not a general file-read API: only files the user has just chosen in the dialog are read.
 */
export class FilePickerMain {
  constructor(private i18nService: I18nService) {}

  init() {
    ipcMain.handle("filePicker.isEnabled", () => shouldBypassXdgPortalFileDialogs());

    ipcMain.handle("filePicker.pickFiles", (event: IpcMainInvokeEvent, options: PickFilesOptions) =>
      this.pickFiles(BrowserWindow.fromWebContents(event.sender), options),
    );
  }

  /** Resolves to the chosen files, or `null` when the dialog was cancelled. */
  async pickFiles(
    window: BrowserWindow | null,
    options: PickFilesOptions,
  ): Promise<PickedFile[] | null> {
    const dialogOptions: OpenDialogOptions = {
      properties: options?.multiple ? ["openFile", "multiSelections"] : ["openFile"],
      filters: this.filtersFromAccept(options?.accept),
    };
    const result =
      window != null
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return Promise.all(
      result.filePaths.map(async (filePath) => ({
        name: path.basename(filePath),
        // Copy into an exact-size ArrayBuffer: Node may back a Buffer with a larger pool, and
        // IPC serializes the whole underlying buffer.
        data: new Uint8Array(await fs.promises.readFile(filePath)),
      })),
    );
  }

  /**
   * Maps an `<input accept>` list to dialog filters. Only extension entries (".json") can be
   * expressed as a filter; MIME patterns ("image/*") are covered by the "all files" entry.
   */
  filtersFromAccept(accept: string | undefined): FileFilter[] {
    const extensions = [
      ...new Set(
        (accept ?? "")
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter((entry) => entry.startsWith(".") && entry.length > 1)
          .map((entry) => entry.slice(1)),
      ),
    ];
    const filters: FileFilter[] = [];
    if (extensions.length > 0) {
      filters.push({
        name: extensions.map((extension) => extension.toUpperCase()).join(", "),
        extensions,
      });
    }
    filters.push({ name: this.i18nService.t("allFiles"), extensions: ["*"] });
    return filters;
  }
}

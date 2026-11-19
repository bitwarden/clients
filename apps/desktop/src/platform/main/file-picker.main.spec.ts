import * as fs from "fs";

import { BrowserWindow, dialog, ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

jest.mock("electron", () => ({
  BrowserWindow: { fromWebContents: jest.fn() },
  dialog: { showOpenDialog: jest.fn() },
  ipcMain: { handle: jest.fn() },
}));

// window.main.ts registers a privileged scheme and loads a native module at import time.
jest.mock("../../main/window.main", () => ({
  shouldBypassXdgPortalFileDialogs: jest.fn(),
}));

import { shouldBypassXdgPortalFileDialogs } from "../../main/window.main";

import { FilePickerMain } from "./file-picker.main";

describe("FilePickerMain", () => {
  const i18nService = mock<I18nService>();
  const window = {} as BrowserWindow;
  const cancelled = { canceled: true, filePaths: [] };
  let readFile: jest.SpyInstance;
  let filePickerMain: FilePickerMain;

  beforeEach(() => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((id) => (id === "allFiles" ? "All files" : id));
    readFile = jest.spyOn(fs.promises, "readFile");
    filePickerMain = new FilePickerMain(i18nService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("init", () => {
    const handler = (channel: string) => {
      const registration = jest
        .mocked(ipcMain.handle)
        .mock.calls.find(([name]) => name === channel);
      if (registration == null) {
        throw new Error(`No handler registered for ${channel}`);
      }
      return registration[1];
    };

    it("reports whether the portal bypass is active", () => {
      jest.mocked(shouldBypassXdgPortalFileDialogs).mockReturnValue(true);
      filePickerMain.init();

      expect(handler("filePicker.isEnabled")({} as any)).toBe(true);
    });

    it("opens the dialog for the window that sent the request", async () => {
      jest.mocked(BrowserWindow.fromWebContents).mockReturnValue(window);
      jest.mocked(dialog.showOpenDialog).mockResolvedValue(cancelled);
      filePickerMain.init();
      const sender = {};

      await handler("filePicker.pickFiles")({ sender } as any, { multiple: false });

      expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(sender);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(window, expect.anything());
    });
  });

  describe("pickFiles", () => {
    it("returns null when the dialog is cancelled", async () => {
      jest.mocked(dialog.showOpenDialog).mockResolvedValue(cancelled);

      await expect(filePickerMain.pickFiles(window, {})).resolves.toBeNull();
      expect(readFile).not.toHaveBeenCalled();
    });

    it("returns the chosen files' names and contents", async () => {
      jest.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ["/home/user/Documents/report.pdf"],
      });
      readFile.mockResolvedValue(Buffer.from("pdf bytes"));

      const picked = await filePickerMain.pickFiles(window, { accept: ".pdf" });

      expect(readFile).toHaveBeenCalledWith("/home/user/Documents/report.pdf");
      expect(picked).toEqual([
        { name: "report.pdf", data: new Uint8Array(Buffer.from("pdf bytes")) },
      ]);
    });

    it("asks for one file by default and several when requested", async () => {
      jest.mocked(dialog.showOpenDialog).mockResolvedValue(cancelled);

      await filePickerMain.pickFiles(window, {});
      await filePickerMain.pickFiles(window, { multiple: true });

      expect(dialog.showOpenDialog).toHaveBeenNthCalledWith(
        1,
        window,
        expect.objectContaining({ properties: ["openFile"] }),
      );
      expect(dialog.showOpenDialog).toHaveBeenNthCalledWith(
        2,
        window,
        expect.objectContaining({ properties: ["openFile", "multiSelections"] }),
      );
    });

    it("opens an unparented dialog when the sender has no window", async () => {
      jest.mocked(dialog.showOpenDialog).mockResolvedValue(cancelled);

      await filePickerMain.pickFiles(null, {});

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({ properties: ["openFile"] }),
      );
    });
  });

  describe("filtersFromAccept", () => {
    it("turns extension entries into a filter and keeps an all-files entry", () => {
      expect(filePickerMain.filtersFromAccept(".json, .CSV,.json")).toEqual([
        { name: "JSON, CSV", extensions: ["json", "csv"] },
        { name: "All files", extensions: ["*"] },
      ]);
    });

    it("offers only all files when accept is empty or has no extensions", () => {
      const allFiles = [{ name: "All files", extensions: ["*"] }];

      expect(filePickerMain.filtersFromAccept(undefined)).toEqual(allFiles);
      expect(filePickerMain.filtersFromAccept("")).toEqual(allFiles);
      expect(filePickerMain.filtersFromAccept("image/*")).toEqual(allFiles);
    });
  });
});

import { DOCUMENT } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { NativeFilePickerService } from "./native-file-picker.service";

/** jsdom has no DataTransfer; the service only uses `items.add` and `files`. */
class FakeDataTransfer {
  readonly files: File[] = [];
  readonly items = { add: (file: File) => this.files.push(file) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("NativeFilePickerService", () => {
  const isEnabled = jest.fn();
  const pickFiles = jest.fn();
  let logService: MockProxy<LogService>;
  let doc: Document;
  let input: HTMLInputElement;
  let service: NativeFilePickerService;

  /** Dispatches a cancelable click; returns false when a listener called preventDefault. */
  const click = (target: Element = input) =>
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  beforeEach(() => {
    (globalThis as any).ipc = { platform: { filePicker: { isEnabled, pickFiles } } };
    (globalThis as any).DataTransfer = FakeDataTransfer;
    logService = mock<LogService>();

    doc = document.implementation.createHTMLDocument();
    input = doc.createElement("input");
    input.type = "file";
    // jsdom's `files` setter accepts only a real FileList, which cannot be constructed; shadow it.
    Object.defineProperty(input, "files", { value: null, writable: true });
    doc.body.appendChild(input);

    TestBed.configureTestingModule({
      providers: [
        NativeFilePickerService,
        { provide: DOCUMENT, useValue: doc },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(NativeFilePickerService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete (globalThis as any).ipc;
    delete (globalThis as any).DataTransfer;
  });

  it("leaves file inputs alone when the bypass is not active", async () => {
    isEnabled.mockResolvedValue(false);
    await service.init();

    expect(click()).toBe(true);
    expect(pickFiles).not.toHaveBeenCalled();
  });

  it("does not block startup when the main process cannot be asked", async () => {
    isEnabled.mockRejectedValue(new Error("no handler"));

    await expect(service.init()).resolves.toBeUndefined();

    expect(logService.error).toHaveBeenCalled();
    expect(click()).toBe(true);
    expect(pickFiles).not.toHaveBeenCalled();
  });

  describe("when the bypass is active", () => {
    beforeEach(async () => {
      isEnabled.mockResolvedValue(true);
      await service.init();
    });

    it("replaces the native picker with the main process dialog", async () => {
      input.accept = ".json,.csv";
      pickFiles.mockResolvedValue(null);

      expect(click()).toBe(false);
      await flush();

      expect(pickFiles).toHaveBeenCalledWith({ multiple: false, accept: ".json,.csv" });
    });

    it("hands the chosen files to the input and fires change", async () => {
      const changed = jest.fn();
      input.addEventListener("change", changed);
      pickFiles.mockResolvedValue([{ name: "export.json", data: new Uint8Array([123, 125]) }]);

      click();
      await flush();

      const files = input.files as unknown as File[];
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("export.json");
      expect(files[0].size).toBe(2);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it("leaves the input untouched when the dialog is cancelled", async () => {
      const changed = jest.fn();
      input.addEventListener("change", changed);
      pickFiles.mockResolvedValue(null);

      click();
      await flush();

      expect(input.files).toBeNull();
      expect(changed).not.toHaveBeenCalled();
    });

    it("ignores disabled file inputs and inputs of other types", () => {
      input.disabled = true;
      expect(click()).toBe(true);

      const text = doc.createElement("input");
      text.type = "text";
      doc.body.appendChild(text);
      expect(click(text)).toBe(true);

      expect(pickFiles).not.toHaveBeenCalled();
    });

    it("logs and swallows dialog failures", async () => {
      pickFiles.mockRejectedValue(new Error("dialog failed"));

      click();
      await flush();

      expect(logService.error).toHaveBeenCalled();
    });
  });
});

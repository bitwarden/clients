import { app, ipcMain } from "electron";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@bitwarden/common/autofill/types";
import { clipboards } from "@bitwarden/desktop-napi";

import { ClipboardMain } from "./clipboard.main";

jest.mock("electron", () => ({
  app: { on: jest.fn() },
  ipcMain: { handle: jest.fn() },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  clipboards: {
    read: jest.fn(),
    write: jest.fn(),
  },
}));

type IpcHandler = (...args: unknown[]) => unknown;

describe("ClipboardMain", () => {
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let handlers: Record<string, IpcHandler>;
  let sut: ClipboardMain;

  const setDelaySetting = (setting: ClearClipboardDelaySetting) => {
    autofillSettingsService.clearClipboardDelay$ = of(setting);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    setDelaySetting("tenSeconds");

    handlers = {};
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: IpcHandler) => {
      handlers[channel] = handler;
    });

    (clipboards.write as jest.Mock).mockResolvedValue(undefined);
    (clipboards.read as jest.Mock).mockResolvedValue("");

    sut = new ClipboardMain(true, autofillSettingsService);
    sut.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("registers a before-quit handler that clears the clipboard", () => {
    expect(app.on).toHaveBeenCalledWith("before-quit", expect.any(Function));
  });

  it("schedules a clear after the configured delay once the clipboard still matches", async () => {
    (clipboards.read as jest.Mock).mockResolvedValue("secret");

    await handlers["clipboard.write"](null, { text: "secret" });
    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(clipboards.write).toHaveBeenCalledWith("", false);
  });

  it("does not clear if the clipboard changed before the delay elapsed", async () => {
    (clipboards.read as jest.Mock).mockResolvedValue("something-else");

    await handlers["clipboard.write"](null, { text: "secret" });
    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(clipboards.write).not.toHaveBeenCalledWith("", false);
  });

  it("cancels the previous schedule when a new value is written", async () => {
    (clipboards.read as jest.Mock).mockResolvedValue("secret");
    await handlers["clipboard.write"](null, { text: "secret" });

    (clipboards.read as jest.Mock).mockResolvedValue("second-secret");
    await handlers["clipboard.write"](null, { text: "second-secret" });

    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(clipboards.write).toHaveBeenCalledTimes(3); // the two writes, plus the one scheduled clear
    expect(clipboards.write).toHaveBeenLastCalledWith("", false);
  });

  it("never schedules a clear when the delay setting is never", async () => {
    setDelaySetting("never");
    (clipboards.read as jest.Mock).mockResolvedValue("secret");

    await handlers["clipboard.write"](null, { text: "secret" });
    jest.advanceTimersByTime(10 * 60 * 1000);
    await flushMicrotasks();

    expect(clipboards.write).toHaveBeenCalledTimes(1);
  });

  it("uses an explicit clearMs override instead of the setting", async () => {
    (clipboards.read as jest.Mock).mockResolvedValue("secret");

    await handlers["clipboard.write"](null, { text: "secret", clearMs: 2_000 });
    jest.advanceTimersByTime(2_000);
    await flushMicrotasks();

    expect(clipboards.write).toHaveBeenCalledWith("", false);
  });

  it("clearNow cancels the schedule and clears immediately", async () => {
    (clipboards.read as jest.Mock).mockResolvedValue("secret");

    await handlers["clipboard.write"](null, { text: "secret" });
    (clipboards.write as jest.Mock).mockClear();

    await handlers["clipboard.clearNow"](null);

    expect(clipboards.write).toHaveBeenCalledTimes(1);
    expect(clipboards.write).toHaveBeenCalledWith("", false);

    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    // The schedule from the original write was cancelled, so no further clear runs.
    expect(clipboards.write).toHaveBeenCalledTimes(1);
  });

  it("clearNow does nothing when the delay setting is never", async () => {
    setDelaySetting("never");
    (clipboards.read as jest.Mock).mockResolvedValue("secret");

    await handlers["clipboard.write"](null, { text: "secret" });
    (clipboards.write as jest.Mock).mockClear();

    await handlers["clipboard.clearNow"](null);

    expect(clipboards.write).not.toHaveBeenCalled();
  });

  describe("while the renderer owns the clear timer", () => {
    beforeEach(() => {
      handlers = {};
      jest.clearAllMocks();
      (clipboards.write as jest.Mock).mockResolvedValue(undefined);
      (clipboards.read as jest.Mock).mockResolvedValue("");
      sut = new ClipboardMain(false, autofillSettingsService);
      sut.init();
    });

    it("writes the clipboard but schedules no clear of its own", async () => {
      (clipboards.read as jest.Mock).mockResolvedValue("secret");

      await handlers["clipboard.write"](null, { text: "secret" });
      (clipboards.write as jest.Mock).mockClear();

      jest.advanceTimersByTime(10 * 60 * 1000);
      await flushMicrotasks();

      expect(clipboards.write).not.toHaveBeenCalled();
    });

    it("ignores an explicit clearMs override too", async () => {
      (clipboards.read as jest.Mock).mockResolvedValue("secret");

      await handlers["clipboard.write"](null, { text: "secret", clearMs: 2_000 });
      (clipboards.write as jest.Mock).mockClear();

      jest.advanceTimersByTime(2_000);
      await flushMicrotasks();

      expect(clipboards.write).not.toHaveBeenCalled();
    });

    it("still clears on quit, which is not the delayed clear", async () => {
      (clipboards.read as jest.Mock).mockResolvedValue("secret");
      await handlers["clipboard.write"](null, { text: "secret" });
      (clipboards.write as jest.Mock).mockClear();

      await sut.clearIfUnchanged();

      expect(clipboards.write).toHaveBeenCalledWith("", false);
    });
  });
});

/** Flushes pending microtasks so async handlers settle under fake timers. */
const flushMicrotasks = () => Promise.resolve().then().then();

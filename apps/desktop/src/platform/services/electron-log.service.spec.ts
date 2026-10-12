import { ipcMain } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogLevelType } from "@bitwarden/common/platform/enums/log-level-type.enum";
import { LogRecorder } from "@bitwarden/logging";

import { ElectronLogMainService } from "./electron-log.main.service";
import { ElectronLogRendererService } from "./electron-log.renderer.service";

// Mock the use of the electron API to avoid errors
jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

jest.mock("@bitwarden/desktop-napi", () => {
  return {
    logging: {
      initNapiLog: jest.fn(),
    },
  };
});

describe("ElectronLogMainService", () => {
  let recorder: MockProxy<LogRecorder>;

  beforeEach(() => {
    jest.clearAllMocks();
    recorder = mock<LogRecorder>();
  });

  it("sets dev based on electron method", () => {
    globalThis.BIT_ENVIRONMENT = "development";
    const logService = new ElectronLogMainService();
    expect(logService).toEqual(expect.objectContaining({ isDev: true }) as any);
  });

  it("tees writes to the recorder", () => {
    const logService = new ElectronLogMainService(null, null, recorder);

    logService.write(LogLevelType.Info, "hello", "world");

    expect(recorder.record).toHaveBeenCalledWith(LogLevelType.Info, "hello", "world");
  });

  it("records events the filter suppresses", () => {
    const logService = new ElectronLogMainService(() => true, null, recorder);

    logService.write(LogLevelType.Info, "quiet");

    expect(recorder.record).toHaveBeenCalledWith(LogLevelType.Info, "quiet");
  });

  it("does not record logs forwarded from the renderer, which records its own", () => {
    new ElectronLogMainService(null, null, recorder);
    const [, handler] = (ipcMain.handle as jest.Mock).mock.calls.find(
      ([channel]) => channel === "ipc.log",
    );

    handler(null, { level: LogLevelType.Info, message: "from renderer", optionalParams: [] });

    expect(recorder.record).not.toHaveBeenCalled();
  });
});

describe("ElectronLogRendererService", () => {
  let recorder: MockProxy<LogRecorder>;
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    recorder = mock<LogRecorder>();
    (global as any).ipc = {
      platform: { isDev: false, log: jest.fn().mockResolvedValue(undefined) },
    };
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("tees writes to the recorder once", () => {
    const logService = new ElectronLogRendererService(null, recorder);

    logService.write(LogLevelType.Info, "hello", "world");

    expect(recorder.record).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledWith(LogLevelType.Info, "hello", "world");
  });

  it("writes to the console and forwards to the main process", () => {
    const logService = new ElectronLogRendererService(null, recorder);

    logService.write(LogLevelType.Info, "hello", "world");

    expect(consoleLog).toHaveBeenCalledWith("hello", "world");
    expect((global as any).ipc.platform.log).toHaveBeenCalledWith(
      LogLevelType.Info,
      "hello",
      "world",
    );
  });

  it("records events the filter suppresses", () => {
    const logService = new ElectronLogRendererService(() => true, recorder);

    logService.write(LogLevelType.Info, "quiet");

    expect(recorder.record).toHaveBeenCalledWith(LogLevelType.Info, "quiet");
    expect(consoleLog).not.toHaveBeenCalled();
    expect((global as any).ipc.platform.log).not.toHaveBeenCalled();
  });
});

import log from "electron-log/main";

import { ElectronLogMainService } from "./electron-log.main.service";

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
  it("sets dev based on electron method", () => {
    globalThis.BIT_ENVIRONMENT = "development";
    const logService = new ElectronLogMainService();
    expect(logService).toEqual(expect.objectContaining({ isDev: true }) as any);
  });

  describe("console transport", () => {
    const message = { message: { level: "info", data: ["msg"] } };

    // The guard wraps whatever writeFn is installed at construction time, so the
    // stub is armed only afterwards to keep construction-time logs out of the way.
    function guardedWriteFn(error: Error) {
      let armed = false;

      log.transports.console.writeFn = () => {
        if (armed) {
          throw error;
        }
      };

      new ElectronLogMainService();
      armed = true;

      return () => log.transports.console.writeFn(message as any);
    }

    it("swallows EPIPE errors raised by the console write", () => {
      const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

      expect(guardedWriteFn(epipe)).not.toThrow();
    });

    it("rethrows any other error raised by the console write", () => {
      const other = Object.assign(new Error("boom"), { code: "EACCES" });

      expect(guardedWriteFn(other)).toThrow(other);
    });
  });
});

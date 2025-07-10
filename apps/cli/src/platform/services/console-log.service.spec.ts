import { interceptConsole, restoreConsole } from "@bitwarden/common/spec";

import { ConsoleLogService } from "./console-log.service";

describe("CLI Console log service", () => {
  const error = new Error("this is an error");
  const obj = { a: 1, b: 2 };
  let logService: ConsoleLogService;
  let consoleSpy: {
    log: jest.Mock<any, any>;
    warn: jest.Mock<any, any>;
    error: jest.Mock<any, any>;
  };

  beforeEach(() => {
    consoleSpy = interceptConsole();
    logService = new ConsoleLogService(true);
  });

  afterAll(() => {
    restoreConsole();
  });

  it("should redirect all console to error if BW_RESPONSE env is true", () => {
    process.env.BW_RESPONSE = "true";

    logService.debug("this is a debug message", error, obj);
    expect(consoleSpy.error).toHaveBeenCalledWith("this is a debug message", error, obj);
  });

  it("should not redirect console to error if BW_RESPONSE != true", () => {
    process.env.BW_RESPONSE = "false";

    logService.debug("debug", error, obj);
    logService.info("info", error, obj);
    logService.warning("warning", error, obj);
    logService.error("error", error, obj);

    expect(consoleSpy.log).toHaveBeenCalledWith("debug", error, obj);
    expect(consoleSpy.log).toHaveBeenCalledWith("info", error, obj);
    expect(consoleSpy.warn).toHaveBeenCalledWith("warning", error, obj);
    expect(consoleSpy.error).toHaveBeenCalledWith("error", error, obj);
  });
});

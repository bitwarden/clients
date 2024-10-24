import { awaitAsync, interceptConsole, restoreConsole } from "../../../spec";
import { LogLevelType } from "../enums";

import { ConfigurableConsoleLogService } from "./configurable-console-log.service";

class MissingInitConsoleLogService extends ConfigurableConsoleLogService {
  constructor(isDev: boolean, defaultLogLevel?: LogLevelType) {
    super(isDev, defaultLogLevel, 10);
  }
  protected async readStoredLogLevel(): Promise<LogLevelType> {
    return Promise.resolve(null);
  }

  protected writeStoredLogLevel(level: LogLevelType): Promise<void> {
    return Promise.resolve();
  }
}

class TestConsoleLogService extends ConfigurableConsoleLogService {
  constructor(
    isDev: boolean,
    defaultLogLevel?: LogLevelType,
    public storedLogLevel: LogLevelType | null = null,
  ) {
    super(isDev, defaultLogLevel, 500);
    void super.init();
  }

  protected async readStoredLogLevel(): Promise<LogLevelType> {
    return Promise.resolve(this.storedLogLevel);
  }

  protected writeStoredLogLevel(level: LogLevelType): Promise<void> {
    this.storedLogLevel = level;
    return Promise.resolve();
  }
}

describe("ConsoleLogService failure to init", () => {
  let consoleSpy: {
    log: jest.Mock<any, any>;
    warn: jest.Mock<any, any>;
    error: jest.Mock<any, any>;
  };

  beforeEach(() => {
    consoleSpy = interceptConsole();
  });

  afterEach(() => {
    restoreConsole();
    jest.resetAllMocks();
  });

  it("warns if not initialized", async () => {
    new MissingInitConsoleLogService(true);
    await awaitAsync(25);
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn.mock.calls[0][0]).toEqual(
      "ConfigurableConsoleLogService has not been initialized. Child Logging classes may not have called init",
    );
  });
});

describe("ConsoleLogService properly initialized", () => {
  let consoleSpy: {
    log: jest.Mock<any, any>;
    warn: jest.Mock<any, any>;
    error: jest.Mock<any, any>;
  };

  beforeEach(() => {
    consoleSpy = interceptConsole();
  });

  afterEach(() => {
    restoreConsole();
    jest.resetAllMocks();
  });

  it("warns if not initialized", async () => {
    new TestConsoleLogService(true);
    await awaitAsync(750);
    expect(consoleSpy.warn).not.toHaveBeenCalled;
  });
});

describe("ConsoleLogService", () => {
  const error = new Error("this is an error");
  const obj = { a: 1, b: 2 };
  let consoleSpy: {
    log: jest.Mock<any, any>;
    warn: jest.Mock<any, any>;
    error: jest.Mock<any, any>;
  };
  let logService: ConfigurableConsoleLogService;

  beforeEach(async () => {
    consoleSpy = interceptConsole();
    logService = new TestConsoleLogService(true, LogLevelType.Debug);

    // let the read stored level resolve
    await awaitAsync();
  });

  afterEach(() => {
    restoreConsole();
    jest.resetAllMocks();
  });

  it("filters messages below the set threshold", async () => {
    logService = new TestConsoleLogService(true, LogLevelType.Error);
    logService.debug("debug", error, obj);
    logService.info("info", error, obj);
    logService.warning("warning", error, obj);
    logService.error("error", error, obj);

    await awaitAsync();

    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it("writes messages when no filter is set", async () => {
    logService = new TestConsoleLogService(true, null);
    logService.debug("debug", error, obj);
    logService.info("info", error, obj);
    logService.warning("warning", error, obj);
    logService.error("error", error, obj);

    await awaitAsync();

    expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes;
  });

  describe("updateLogLevel", () => {
    it("updates filter behavior", async () => {
      logService = new TestConsoleLogService(true, LogLevelType.Error);
      logService.debug("debug", error, obj);

      await awaitAsync();

      expect(consoleSpy.log).not.toHaveBeenCalled();

      await logService.updateLogLevel(LogLevelType.Debug);

      logService.debug("debug", error, obj);
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it("updates store log level", async () => {
      expect((logService as TestConsoleLogService).storedLogLevel).toBe(null);
      await logService.updateLogLevel(LogLevelType.Info);
      expect((logService as TestConsoleLogService).storedLogLevel).toBe(LogLevelType.Info);
    });

    it("respects the stored log level", async () => {
      const sut = new TestConsoleLogService(true, LogLevelType.Debug, LogLevelType.Error);

      await awaitAsync();

      expect(sut.logLevel).toBe(LogLevelType.Error);
    });
  });

  it("only writes debug messages in dev mode", async () => {
    logService = new TestConsoleLogService(false);

    await awaitAsync();

    logService.debug("debug message");
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it("writes debug/info messages to console.log", () => {
    logService.debug("this is a debug message", error, obj);
    logService.info("this is an info message", error, obj);

    expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    expect(consoleSpy.log).toHaveBeenCalledWith("this is a debug message", error, obj);
    expect(consoleSpy.log).toHaveBeenCalledWith("this is an info message", error, obj);
  });

  it("writes warning messages to console.warn", () => {
    logService.warning("this is a warning message", error, obj);

    expect(consoleSpy.warn).toHaveBeenCalledWith("this is a warning message", error, obj);
  });

  it("writes error messages to console.error", () => {
    logService.error("this is an error message", error, obj);

    expect(consoleSpy.error).toHaveBeenCalledWith("this is an error message", error, obj);
  });
});

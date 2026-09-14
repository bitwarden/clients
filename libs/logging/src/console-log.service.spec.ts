import { mock } from "jest-mock-extended";

import { ConsoleLogService } from "./console-log.service";
import { LogLevel } from "./log-level";
import { LogRecorder } from "./log-recorder";

describe("ConsoleLogService", () => {
  const error = new Error("this is an error");
  const obj = { a: 1, b: 2 };

  let recorder: LogRecorder;
  let consoleLog: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    recorder = mock<LogRecorder>();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("tees every write to the recorder with level, message, and params", () => {
    const service = new ConsoleLogService(true, null, recorder);

    service.write(LogLevel.Info, "hello", "world");

    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Info, "hello", "world");
  });

  it("records events even when the filter suppresses console output", () => {
    const filter = (level: LogLevel) => level === LogLevel.Info;
    const service = new ConsoleLogService(true, filter, recorder);

    service.write(LogLevel.Info, "quiet on the console");

    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Info, "quiet on the console");
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("tees before the filter for every level, including filtered ones", () => {
    const filter = () => true; // suppress all console output
    const service = new ConsoleLogService(true, filter, recorder);

    service.debug("d");
    service.info("i");
    service.warning("w");
    service.error("e");

    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Debug, "d");
    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Info, "i");
    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Warning, "w");
    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Error, "e");
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("writes debug and info messages to console.log", () => {
    const service = new ConsoleLogService(true, null, recorder);

    service.debug("this is a debug message", error, obj);
    service.info("this is an info message", error, obj);

    expect(consoleLog).toHaveBeenCalledTimes(2);
    expect(consoleLog).toHaveBeenCalledWith("this is a debug message", error, obj);
    expect(consoleLog).toHaveBeenCalledWith("this is an info message", error, obj);
  });

  it("writes warning messages to console.warn", () => {
    const service = new ConsoleLogService(true, null, recorder);

    service.warning("this is a warning message", error, obj);

    expect(consoleWarn).toHaveBeenCalledWith("this is a warning message", error, obj);
  });

  it("writes error messages to console.error", () => {
    const service = new ConsoleLogService(true, null, recorder);

    service.error("this is an error message", error, obj);

    expect(consoleError).toHaveBeenCalledWith("this is an error message", error, obj);
  });

  it("does not throw when no recorder is provided", () => {
    const service = new ConsoleLogService(true);

    expect(() => service.info("no recorder")).not.toThrow();
    expect(consoleLog).toHaveBeenCalledWith("no recorder");
  });

  it("keeps logging to the console when the recorder throws", () => {
    recorder.record = jest.fn(() => {
      throw new Error("recorder is broken");
    });
    const service = new ConsoleLogService(true, null, recorder);

    expect(() => service.error("still reaches the console")).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith("still reaches the console");
  });

  it("tees info-funneled measure calls to the recorder", () => {
    const service = new ConsoleLogService(true, null, recorder);

    service.measure(0, "group", "track", "name");

    expect(recorder.record).toHaveBeenCalledWith(
      LogLevel.Info,
      expect.stringContaining("[track]: name took"),
      undefined,
    );
  });

  it("does not tee prod debug logs, which return before write", () => {
    const service = new ConsoleLogService(false, null, recorder);

    service.debug("dev only");

    expect(recorder.record).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("tees debug logs to the recorder in dev", () => {
    const service = new ConsoleLogService(true, null, recorder);

    service.debug("dev debug");

    expect(recorder.record).toHaveBeenCalledWith(LogLevel.Debug, "dev debug");
  });
});

import { mock, MockProxy } from "jest-mock-extended";

import { FlightRecorderClient, LogLevel as SdkLogLevel } from "@bitwarden/sdk-internal";

import { FlightRecorderLogRecorder } from "./flight-recorder-log-recorder";
import { LogLevel } from "./log-level";

describe("FlightRecorderLogRecorder", () => {
  let client: MockProxy<FlightRecorderClient>;
  let resolveClient: (client: FlightRecorderClient) => void;
  let rejectClient: (reason: unknown) => void;
  let recorder: FlightRecorderLogRecorder;

  beforeEach(() => {
    client = mock<FlightRecorderClient>();
    jest.spyOn(Date, "now").mockReturnValue(1000);
    recorder = new FlightRecorderLogRecorder(
      new Promise<FlightRecorderClient>((resolve, reject) => {
        resolveClient = resolve;
        rejectClient = reject;
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Hands the client to the recorder and lets it flush. */
  const ready = async () => {
    resolveClient(client);
    await Promise.resolve();
  };

  /** Fails the SDK load and lets the recorder drop its queue. */
  const failLoad = async () => {
    rejectClient(new Error("load failed"));
    await Promise.resolve();
  };

  describe("once the client is ready", () => {
    beforeEach(() => ready());

    it("writes the record straight through", () => {
      recorder.record(LogLevel.Info, "hello");

      expect(client.write).toHaveBeenCalledWith(1000, SdkLogLevel.Info, "typescript", "hello");
    });

    it.each([
      [LogLevel.Debug, SdkLogLevel.Debug],
      [LogLevel.Info, SdkLogLevel.Info],
      [LogLevel.Warning, SdkLogLevel.Warn],
      [LogLevel.Error, SdkLogLevel.Error],
    ])("maps level %s onto SDK level %s", (level, expected) => {
      recorder.record(level, "hello");

      expect(client.write).toHaveBeenCalledWith(1000, expected, "typescript", "hello");
    });

    it("stamps each record with the time it was recorded", () => {
      jest.spyOn(Date, "now").mockReturnValue(5000);

      recorder.record(LogLevel.Info, "hello");

      expect(client.write).toHaveBeenCalledWith(5000, SdkLogLevel.Info, "typescript", "hello");
    });

    it("joins the message and its parameters", () => {
      recorder.record(LogLevel.Info, "sync failed", { attempt: 2 }, 42);

      expect(client.write).toHaveBeenCalledWith(
        1000,
        SdkLogLevel.Info,
        "typescript",
        'sync failed {"attempt":2} 42',
      );
    });

    it("skips parameters that stringify to nothing", () => {
      recorder.record(LogLevel.Info, "hello", undefined, "world");

      expect(client.write).toHaveBeenCalledWith(
        1000,
        SdkLogLevel.Info,
        "typescript",
        "hello world",
      );
    });

    it("does not throw when the client write fails", () => {
      client.write.mockImplementation(() => {
        throw new Error("WASM exploded");
      });

      expect(() => recorder.record(LogLevel.Error, "hello")).not.toThrow();
    });
  });

  describe("before the client is ready", () => {
    it("replays queued records in order with their original timestamps", async () => {
      recorder.record(LogLevel.Info, "first");
      jest.spyOn(Date, "now").mockReturnValue(2000);
      recorder.record(LogLevel.Error, "second");

      expect(client.write).not.toHaveBeenCalled();

      await ready();

      expect(client.write.mock.calls).toEqual([
        [1000, SdkLogLevel.Info, "typescript", "first"],
        [2000, SdkLogLevel.Error, "typescript", "second"],
      ]);
    });

    it("keeps replaying after a queued write fails", async () => {
      client.write.mockImplementationOnce(() => {
        throw new Error("WASM exploded");
      });

      recorder.record(LogLevel.Info, "first");
      recorder.record(LogLevel.Info, "second");
      await ready();

      expect(client.write).toHaveBeenCalledTimes(2);
      expect(client.write).toHaveBeenLastCalledWith(1000, SdkLogLevel.Info, "typescript", "second");
    });

    it("drops records once the queue is full", async () => {
      for (let i = 0; i < 1001; i++) {
        recorder.record(LogLevel.Info, `message ${i}`);
      }
      await ready();

      expect(client.write).toHaveBeenCalledTimes(1000);
      expect(client.write).toHaveBeenLastCalledWith(
        1000,
        SdkLogLevel.Info,
        "typescript",
        "message 999",
      );
    });

    it("replays the queue only once", async () => {
      recorder.record(LogLevel.Info, "first");
      await ready();
      recorder.record(LogLevel.Info, "second");

      expect(client.write).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the SDK fails to load", () => {
    it("drops queued records", async () => {
      recorder.record(LogLevel.Info, "queued");

      await failLoad();

      expect(client.write).not.toHaveBeenCalled();
    });

    it("discards later records instead of queueing them", async () => {
      await failLoad();

      expect(() => recorder.record(LogLevel.Info, "hello")).not.toThrow();
      expect(client.write).not.toHaveBeenCalled();
    });
  });

  it("records the configured target", async () => {
    const targeted = new FlightRecorderLogRecorder(Promise.resolve(client), "background");
    await Promise.resolve();

    targeted.record(LogLevel.Info, "hello");

    expect(client.write).toHaveBeenCalledWith(1000, SdkLogLevel.Info, "background", "hello");
  });
});

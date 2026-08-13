import { mock, MockProxy } from "jest-mock-extended";

import { FlightRecorderClient, LogLevel as SdkLogLevel } from "@bitwarden/sdk-internal";

import { FlightRecorderLogRecorder } from "./flight-recorder-log-recorder";
import { LogLevel } from "./log-level";

let mockClient: MockProxy<FlightRecorderClient>;

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  FlightRecorderClient: jest.fn().mockImplementation(() => mockClient),
}));

/** Lets the recorder's SDK-ready chain settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("FlightRecorderLogRecorder", () => {
  let resolveSdk: () => void;
  let rejectSdk: (reason: unknown) => void;
  let recorder: FlightRecorderLogRecorder;

  beforeEach(() => {
    mockClient = mock<FlightRecorderClient>();
    jest.spyOn(Date, "now").mockReturnValue(1000);
    recorder = new FlightRecorderLogRecorder(
      new Promise<void>((resolve, reject) => {
        resolveSdk = resolve;
        rejectSdk = reject;
      }),
    );
    recorder.setEnabled(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Loads the SDK and lets the recorder flush. */
  const ready = async () => {
    resolveSdk();
    await settle();
  };

  /** Fails the SDK load and lets the recorder drop its queue. */
  const failLoad = async () => {
    rejectSdk(new Error("load failed"));
    await settle();
  };

  describe("once the client is ready", () => {
    beforeEach(() => ready());

    it("writes the record straight through", () => {
      recorder.record(LogLevel.Info, "hello");

      expect(mockClient.write).toHaveBeenCalledWith(1000, SdkLogLevel.Info, "typescript", "hello");
    });

    it.each([
      [LogLevel.Debug, SdkLogLevel.Debug],
      [LogLevel.Info, SdkLogLevel.Info],
      [LogLevel.Warning, SdkLogLevel.Warn],
      [LogLevel.Error, SdkLogLevel.Error],
    ])("maps level %s onto SDK level %s", (level, expected) => {
      recorder.record(level, "hello");

      expect(mockClient.write).toHaveBeenCalledWith(1000, expected, "typescript", "hello");
    });

    it("stamps each record with the time it was recorded", () => {
      jest.spyOn(Date, "now").mockReturnValue(5000);

      recorder.record(LogLevel.Info, "hello");

      expect(mockClient.write).toHaveBeenCalledWith(5000, SdkLogLevel.Info, "typescript", "hello");
    });

    it("joins the message and its parameters", () => {
      recorder.record(LogLevel.Info, "sync failed", { attempt: 2 }, 42);

      expect(mockClient.write).toHaveBeenCalledWith(
        1000,
        SdkLogLevel.Info,
        "typescript",
        'sync failed {"attempt":2} 42',
      );
    });

    it("skips parameters that stringify to nothing", () => {
      recorder.record(LogLevel.Info, "hello", undefined, "world");

      expect(mockClient.write).toHaveBeenCalledWith(
        1000,
        SdkLogLevel.Info,
        "typescript",
        "hello world",
      );
    });

    it("does not throw when the mockClient write fails", () => {
      mockClient.write.mockImplementation(() => {
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

      expect(mockClient.write).not.toHaveBeenCalled();

      await ready();

      expect(mockClient.write.mock.calls).toEqual([
        [1000, SdkLogLevel.Info, "typescript", "first"],
        [2000, SdkLogLevel.Error, "typescript", "second"],
      ]);
    });

    it("keeps replaying after a queued write fails", async () => {
      mockClient.write.mockImplementationOnce(() => {
        throw new Error("WASM exploded");
      });

      recorder.record(LogLevel.Info, "first");
      recorder.record(LogLevel.Info, "second");
      await ready();

      expect(mockClient.write).toHaveBeenCalledTimes(2);
      expect(mockClient.write).toHaveBeenLastCalledWith(
        1000,
        SdkLogLevel.Info,
        "typescript",
        "second",
      );
    });

    it("drops records once the queue is full", async () => {
      for (let i = 0; i < 1001; i++) {
        recorder.record(LogLevel.Info, `message ${i}`);
      }
      await ready();

      expect(mockClient.write).toHaveBeenCalledTimes(1000);
      expect(mockClient.write).toHaveBeenLastCalledWith(
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

      expect(mockClient.write).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the SDK fails to load", () => {
    it("drops queued records", async () => {
      recorder.record(LogLevel.Info, "queued");

      await failLoad();

      expect(mockClient.write).not.toHaveBeenCalled();
    });

    it("discards later records instead of queueing them", async () => {
      await failLoad();

      expect(() => recorder.record(LogLevel.Info, "hello")).not.toThrow();
      expect(mockClient.write).not.toHaveBeenCalled();
    });
  });

  describe("when disabled", () => {
    let disabled: FlightRecorderLogRecorder;

    beforeEach(async () => {
      disabled = new FlightRecorderLogRecorder(Promise.resolve());
      await Promise.resolve();
    });

    it("drops what queued up beforehand", () => {
      disabled.record(LogLevel.Info, "queued");

      disabled.setEnabled(false);

      expect(mockClient.write).not.toHaveBeenCalled();
    });

    it("discards later records instead of queueing them", () => {
      disabled.setEnabled(false);

      disabled.record(LogLevel.Info, "hello");

      expect(mockClient.write).not.toHaveBeenCalled();
    });

    it("stays disabled when enabled again", () => {
      disabled.setEnabled(false);
      disabled.setEnabled(true);

      disabled.record(LogLevel.Info, "hello");

      expect(mockClient.write).not.toHaveBeenCalled();
    });
  });

  describe("before the flag is known", () => {
    let undecided: FlightRecorderLogRecorder;

    beforeEach(async () => {
      undecided = new FlightRecorderLogRecorder(Promise.resolve());
      await Promise.resolve();
    });

    it("queues rather than recording or dropping", () => {
      undecided.record(LogLevel.Info, "queued");

      expect(mockClient.write).not.toHaveBeenCalled();
    });

    it("replays the queue once enabled", () => {
      undecided.record(LogLevel.Info, "queued");

      undecided.setEnabled(true);

      expect(mockClient.write).toHaveBeenCalledWith(1000, SdkLogLevel.Info, "typescript", "queued");
    });

    it("ignores a later decision", () => {
      undecided.setEnabled(true);
      undecided.setEnabled(false);

      undecided.record(LogLevel.Info, "hello");

      expect(mockClient.write).toHaveBeenCalledWith(1000, SdkLogLevel.Info, "typescript", "hello");
    });
  });

  it("records the configured target", async () => {
    const targeted = new FlightRecorderLogRecorder(Promise.resolve(), "background");
    targeted.setEnabled(true);
    await settle();

    targeted.record(LogLevel.Info, "hello");

    expect(mockClient.write).toHaveBeenCalledWith(1000, SdkLogLevel.Info, "background", "hello");
  });
});

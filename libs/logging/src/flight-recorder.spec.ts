import { FlightRecorderEvent } from "@bitwarden/sdk-internal";

import { FlightRecorder } from "./flight-recorder";

const mockRead = jest.fn();
const mockCount = jest.fn();

jest.mock("@bitwarden/sdk-internal", () => ({
  FlightRecorderClient: jest.fn().mockImplementation(() => ({
    read: mockRead,
    count: mockCount,
  })),
}));

describe("FlightRecorder", () => {
  let sdkReady: Promise<void>;

  beforeEach(() => {
    sdkReady = Promise.resolve();
    jest.clearAllMocks();
  });

  describe("read", () => {
    it("returns events from the underlying client", async () => {
      const events: FlightRecorderEvent[] = [
        {
          timestamp: 1000,
          level: "INFO",
          target: "bitwarden_core::client",
          message: "Client initialized",
          fields: {},
        },
      ];
      mockRead.mockReturnValue(events);
      const recorder = new FlightRecorder(sdkReady);

      const result = await recorder.read();

      expect(result).toEqual(events);
    });

    it("returns an empty array when there are no events", async () => {
      mockRead.mockReturnValue([]);
      const recorder = new FlightRecorder(sdkReady);

      const result = await recorder.read();

      expect(result).toEqual([]);
    });
  });

  describe("count", () => {
    it("returns the event count from the underlying client", async () => {
      mockCount.mockReturnValue(5);
      const recorder = new FlightRecorder(sdkReady);

      const result = await recorder.count();

      expect(result).toBe(5);
    });

    it("returns zero when there are no events", async () => {
      mockCount.mockReturnValue(0);
      const recorder = new FlightRecorder(sdkReady);

      const result = await recorder.count();

      expect(result).toBe(0);
    });
  });

  describe("lazy initialization", () => {
    it("waits for the SDK to be ready before creating the client", async () => {
      let resolve: () => void;
      const pending = new Promise<void>((r) => (resolve = r));
      const recorder = new FlightRecorder(pending);
      mockCount.mockReturnValue(0);

      const countPromise = recorder.count();

      // The client shouldn't have been created yet
      const { FlightRecorderClient: MockClient } = jest.requireMock("@bitwarden/sdk-internal");
      expect(MockClient).not.toHaveBeenCalled();

      resolve!();
      await countPromise;

      expect(MockClient).toHaveBeenCalledTimes(1);
    });

    it("reuses the same client across multiple calls", async () => {
      const recorder = new FlightRecorder(sdkReady);
      mockCount.mockReturnValue(0);
      mockRead.mockReturnValue([]);

      await recorder.count();
      await recorder.read();

      const { FlightRecorderClient: MockClient } = jest.requireMock("@bitwarden/sdk-internal");
      expect(MockClient).toHaveBeenCalledTimes(1);
    });

    it("creates only one client when concurrent calls race during SDK init", async () => {
      let resolve: () => void;
      const pending = new Promise<void>((r) => (resolve = r));
      const recorder = new FlightRecorder(pending);
      mockCount.mockReturnValue(0);
      mockRead.mockReturnValue([]);

      // Fire two calls concurrently while sdkReady is still pending
      const p1 = recorder.count();
      const p2 = recorder.read();

      resolve!();
      await Promise.all([p1, p2]);

      const { FlightRecorderClient: MockClient } = jest.requireMock("@bitwarden/sdk-internal");
      expect(MockClient).toHaveBeenCalledTimes(1);
    });

    it("propagates SDK load failures", async () => {
      const failing = Promise.reject(new Error("WASM load failed"));
      const recorder = new FlightRecorder(failing);

      await expect(recorder.read()).rejects.toThrow("WASM load failed");
    });
  });
});

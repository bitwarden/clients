import {
  PerformanceEvent as SdkPerformanceEvent,
  logPerformanceEvent,
  logPerformanceMark,
  startPerformanceEvent,
} from "@bitwarden/sdk-internal";

import { DefaultPerformanceTrackingService } from "./default-performance-tracking.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  startPerformanceEvent: jest.fn(),
  logPerformanceEvent: jest.fn(),
  logPerformanceMark: jest.fn(),
}));

describe("DefaultPerformanceTrackingService", () => {
  const descriptor = {
    namespace: "Key Management",
    category: "DefaultUnlockService",
    name: "unlockWithPin",
    properties: [["userId", "a-user-id"]] as [string, any][],
  };

  let sdkEvent: jest.Mocked<SdkPerformanceEvent>;
  let tracking: DefaultPerformanceTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();

    sdkEvent = {
      mark: jest.fn(),
      finish: jest.fn(),
    } as unknown as jest.Mocked<SdkPerformanceEvent>;
    jest.mocked(startPerformanceEvent).mockReturnValue(sdkEvent);

    tracking = new DefaultPerformanceTrackingService();
  });

  it("starts an event from the descriptor", () => {
    tracking.startEvent(descriptor);

    expect(startPerformanceEvent).toHaveBeenCalledWith(
      "Key Management",
      "DefaultUnlockService",
      "unlockWithPin",
      descriptor.properties,
    );
  });

  it("scopes marks to the event", () => {
    tracking.startEvent(descriptor).mark("pin validated");

    expect(sdkEvent.mark).toHaveBeenCalledWith("pin validated");
  });

  it("finishes the event with the properties given at the end", () => {
    tracking.startEvent(descriptor).finish([["outcome", "success"]]);

    expect(sdkEvent.finish).toHaveBeenCalledWith([["outcome", "success"]]);
  });

  it("finishes an event only once, because finishing frees the handle", () => {
    const event = tracking.startEvent(descriptor);

    event.finish();
    event.finish();

    expect(sdkEvent.finish).toHaveBeenCalledTimes(1);
  });

  it("logs a point-in-time event", () => {
    tracking.logEvent(descriptor);

    expect(logPerformanceEvent).toHaveBeenCalledWith(
      "Key Management",
      "DefaultUnlockService",
      "unlockWithPin",
      descriptor.properties,
    );
  });

  it("logs a standalone mark", () => {
    tracking.mark("a mark");

    expect(logPerformanceMark).toHaveBeenCalledWith("a mark");
  });

  describe("before the SDK is loaded", () => {
    beforeEach(() => {
      jest.mocked(startPerformanceEvent).mockImplementation(() => {
        throw new Error("null pointer passed to rust");
      });
      jest.mocked(logPerformanceEvent).mockImplementation(() => {
        throw new Error("null pointer passed to rust");
      });
    });

    it("drops the event instead of throwing into the caller", () => {
      const event = tracking.startEvent(descriptor);

      expect(() => {
        event.mark("pin validated");
        event.finish();
      }).not.toThrow();
      expect(() => tracking.logEvent(descriptor)).not.toThrow();
    });
  });
});

import {
  DefaultPerformanceTrackingService,
  INSTANT_EVENT_DURATION_MS,
  INSTANT_EVENT_PROPERTY,
} from "./default-performance-tracking.service";

describe("DefaultPerformanceTrackingService", () => {
  const descriptor = {
    namespace: "Key Management",
    category: "DefaultUnlockService",
    name: "unlockWithPin",
  };

  let log: jest.Mock;
  let measure: jest.SpyInstance;
  let mark: jest.SpyInstance;
  let service: DefaultPerformanceTrackingService;

  beforeEach(() => {
    log = jest.fn();
    measure = jest.spyOn(performance, "measure");
    mark = jest.spyOn(performance, "mark");
    service = new DefaultPerformanceTrackingService(log);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("measure", () => {
    it("writes a track entry named after the track and measure", () => {
      service.measure(0, "group", "track", "name", [["a", 1]]);

      expect(measure).toHaveBeenCalledWith("[track]: name", {
        start: 0,
        end: expect.any(Number),
        detail: {
          devtools: {
            dataType: "track-entry",
            track: "track",
            trackGroup: "group",
            properties: [["a", 1]],
          },
        },
      });
    });

    it("debug-logs the duration", () => {
      service.measure(0, "group", "track", "name");

      expect(log).toHaveBeenCalledWith(expect.stringContaining("[track]: name took"), undefined);
    });
  });

  describe("mark", () => {
    it("writes a marker and debug-logs it", () => {
      service.mark("a mark");

      expect(mark).toHaveBeenCalledWith("a mark", {
        detail: { devtools: { dataType: "marker" } },
      });
      expect(log).toHaveBeenCalledWith("a mark", expect.any(String));
    });
  });

  describe("startEvent", () => {
    it("does not write a measurement until the event finishes", () => {
      const event = service.startEvent(descriptor);

      expect(measure).not.toHaveBeenCalled();

      event.finish();

      expect(measure).toHaveBeenCalledTimes(1);
    });

    it("maps the descriptor onto the track group, track and name", () => {
      service.startEvent(descriptor).finish();

      expect(measure).toHaveBeenCalledWith(
        "[DefaultUnlockService]: unlockWithPin",
        expect.objectContaining({
          detail: {
            devtools: expect.objectContaining({
              track: "DefaultUnlockService",
              trackGroup: "Key Management",
            }),
          },
        }),
      );
    });

    it("merges the properties given at start with those given at finish", () => {
      service
        .startEvent({ ...descriptor, properties: [["userId", "user-1"]] })
        .finish([["ok", true]]);

      expect(measure).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          detail: {
            devtools: expect.objectContaining({
              properties: [
                ["userId", "user-1"],
                ["ok", true],
              ],
            }),
          },
        }),
      );
    });

    it("writes only once when finished twice", () => {
      const event = service.startEvent(descriptor);

      const first = event.finish();
      const second = event.finish();

      expect(measure).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });

    it("scopes marks to the event", () => {
      service.startEvent(descriptor).mark("pin validated");

      expect(mark).toHaveBeenCalledWith(
        "[DefaultUnlockService] unlockWithPin: pin validated",
        expect.anything(),
      );
    });
  });

  describe("logEvent", () => {
    it("writes a nominal-duration entry flagged as instant", () => {
      service.logEvent({ ...descriptor, properties: [["reason", "timeout"]] });

      const [, options] = measure.mock.calls[0];
      expect(options.end - options.start).toBe(INSTANT_EVENT_DURATION_MS);
      expect(options.detail.devtools.properties).toEqual([
        ["reason", "timeout"],
        [INSTANT_EVENT_PROPERTY, true],
      ]);
    });
  });
});

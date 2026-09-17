import { EventProperties, PerformanceEvent, PerformanceEventDescriptor } from "./performance-event";

export abstract class PerformanceTrackingService {
  /**
   * Helper wrapper around `performance.measure` to log a measurement. Should also debug-log the data.
   *
   * @deprecated Use `startEvent` and `finish` instead, which provide a better API
   * @param start Start time of the measurement.
   * @param trackGroup A track-group for the measurement, should generally be the team owning the domain.
   * @param track A track for the measurement, should generally be the class name.
   * @param measureName A descriptive name for the measurement.
   * @param properties Additional properties to include.
   */
  abstract measure(
    start: DOMHighResTimeStamp,
    trackGroup: string,
    track: string,
    measureName: string,
    properties?: EventProperties,
  ): PerformanceMeasure;

  /**
   * Helper wrapper around `performance.mark` to log a mark. Should also debug-log the data.
   *
   * @param name Name of the mark to create.
   */
  abstract mark(name: string): PerformanceMark;

  /**
   * Starts a timed event. The caller holds on to the returned event, optionally marks intermediate
   * steps on it, and calls `finish()` once done — which writes the measurement automatically.
   *
   * ```typescript
   * const event = performanceTracking.startEvent({
   *   namespace: "Key Management",
   *   category: "DefaultUnlockService",
   *   name: "unlockWithPin",
   *   properties: [["userId", userId]],
   * });
   * event.mark("pin validated");
   * // ...
   * event.finish();
   * ```
   */
  abstract startEvent(descriptor: PerformanceEventDescriptor): PerformanceEvent;

  /**
   * Records a point-in-time event. Because a zero-length entry is invisible in the devtools
   * performance panel, the event is written with a fixed, nominal duration and flagged with the
   * `instant` property so it is not mistaken for a real measurement.
   */
  abstract logEvent(descriptor: PerformanceEventDescriptor): PerformanceMeasure;
}

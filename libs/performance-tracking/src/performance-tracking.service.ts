import { PerformanceEvent, PerformanceEventDescriptor } from "./performance-event";

export abstract class PerformanceTrackingService {
  /**
   * Helper wrapper around `performance.mark` to log a mark. Should also debug-log the data.
   *
   * @param name Name of the mark to create.
   */
  abstract mark(name: string): void;

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
  abstract logEvent(descriptor: PerformanceEventDescriptor): void;
}

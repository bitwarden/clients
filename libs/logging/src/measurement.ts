/**
 * A running performance measurement, created by `LogService.startMeasurement`.
 * Captures the start time on creation so callers don't track it themselves.
 *
 * Track group is the domain or flow (e.g. `"Unlock"`), track is the sub-area within it
 * (e.g. `"Folders"`), and the entry name is shown on the track without a prefix.
 *
 * @example
 * ```typescript
 * const measurement = this.logService.startMeasurement("Unlock", "Folders", "decryptFolders");
 * const folders = await decrypt();
 * measurement.finish([["Items", folders.length]]);
 * ```
 */
/** Duration given to instant events so they stay visible on the DevTools timeline. */
const DEFAULT_DURATION_MS = 50;

export class Measurement {
  private readonly start = performance.now();

  /**
   * @param record Records the DevTools track entry from `start` until now, or for `duration` ms
   * when given, bound to the track group, track and entry name given to
   * `LogService.startMeasurement`.
   */
  constructor(
    private readonly record: (
      start: DOMHighResTimeStamp,
      properties?: [string, any][],
      duration?: number,
    ) => PerformanceMeasure,
  ) {}

  /**
   * Records a DevTools track entry from creation until now and debug-logs it.
   *
   * @param properties Additional properties to include, e.g. counts only known at the end.
   */
  finish(properties?: [string, any][]): PerformanceMeasure {
    return this.record(this.start, properties);
  }

  /**
   * Records a DevTools track entry like {@link finish}, but the actual measurement time is
   * replaced by a default value. Use it to track instant events on the timeline, which would
   * otherwise be too short to see, e.g. an incoming notification.
   *
   * @param properties Additional properties to include.
   */
  finishWithDefaultTime(properties?: [string, any][]): PerformanceMeasure {
    return this.record(this.start, properties, DEFAULT_DURATION_MS);
  }
}

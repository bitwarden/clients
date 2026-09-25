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
export class Measurement {
  private readonly start = performance.now();

  /**
   * @param record Records the DevTools track entry from `start` until now, bound to the
   * track group, track and entry name given to `LogService.startMeasurement`.
   */
  constructor(
    private readonly record: (
      start: DOMHighResTimeStamp,
      properties?: [string, any][],
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
}

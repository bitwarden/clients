/**
 * A running performance measurement, created by `LogService.startMeasurement`.
 * Captures the start time on creation so callers don't track it themselves.
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

  constructor(
    private readonly record: (
      start: DOMHighResTimeStamp,
      properties?: [string, any][],
    ) => PerformanceMeasure,
  ) {}

  /**
   * Records the measurement from creation until now.
   *
   * @param properties Additional properties to include, e.g. counts only known at the end.
   */
  finish(properties?: [string, any][]): PerformanceMeasure {
    return this.record(this.start, properties);
  }
}

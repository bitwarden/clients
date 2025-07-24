import { LogLevel } from "./log-level";

export abstract class LogService {
  abstract debug(message?: any, ...optionalParams: any[]): void;
  abstract info(message?: any, ...optionalParams: any[]): void;
  abstract warning(message?: any, ...optionalParams: any[]): void;
  abstract error(message?: any, ...optionalParams: any[]): void;
  abstract write(level: LogLevel, message?: any, ...optionalParams: any[]): void;

  /**
   * Helper wrapper around `performance.measure` to log a measurement. Should also debug-log the data.
   *
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
    properties?: [string, any][],
  ): PerformanceMeasure;

  /**
   * Helper wrapper around `performance.mark` to log a mark. Should also debug-log the data.
   *
   * @param name Name of the mark to create.
   */
  abstract mark(name: string): PerformanceMark;
}

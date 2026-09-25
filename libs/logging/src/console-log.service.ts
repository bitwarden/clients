import { LogLevel } from "./log-level";
import { LogRecorder } from "./log-recorder";
import { LogService } from "./log.service";
import { Measurement } from "./measurement";
import { recordTrackEntry } from "./track-entry";

export class ConsoleLogService implements LogService {
  protected timersMap: Map<string, [number, number]> = new Map();

  constructor(
    protected isDev: boolean,
    protected filter: ((level: LogLevel) => boolean) | null = null,
    protected recorder: LogRecorder | null = null,
  ) {}

  debug(message?: any, ...optionalParams: any[]) {
    if (!this.isDev) {
      return;
    }
    this.write(LogLevel.Debug, message, ...optionalParams);
  }

  info(message?: any, ...optionalParams: any[]) {
    this.write(LogLevel.Info, message, ...optionalParams);
  }

  warning(message?: any, ...optionalParams: any[]) {
    this.write(LogLevel.Warning, message, ...optionalParams);
  }

  error(message?: any, ...optionalParams: any[]) {
    this.write(LogLevel.Error, message, ...optionalParams);
  }

  write(level: LogLevel, message?: any, ...optionalParams: any[]) {
    try {
      this.recorder?.record(level, message, ...optionalParams);
    } catch {
      // Ignore error
    }

    if (this.filter != null && this.filter(level)) {
      return;
    }

    switch (level) {
      case LogLevel.Debug:
        // eslint-disable-next-line
        console.log(message, ...optionalParams);
        break;
      case LogLevel.Info:
        // eslint-disable-next-line
        console.log(message, ...optionalParams);
        break;
      case LogLevel.Warning:
        // eslint-disable-next-line
        console.warn(message, ...optionalParams);
        break;
      case LogLevel.Error:
        // eslint-disable-next-line
        console.error(message, ...optionalParams);
        break;
      default:
        break;
    }
  }

  measure(
    start: DOMHighResTimeStamp,
    trackGroup: string,
    track: string,
    name?: string,
    properties?: [string, any][],
  ): PerformanceMeasure {
    return this.recordMeasure(`[${track}]: ${name}`, start, trackGroup, track, properties);
  }

  startMeasurement(trackGroup: string, track: string, measureName: string): Measurement {
    // The DevTools track already shows the track, so the entry keeps the bare name
    return new Measurement((start, properties, duration) =>
      this.recordMeasure(measureName, start, trackGroup, track, properties, duration),
    );
  }

  /**
   * Records a DevTools track entry and debug-logs it.
   *
   * @param entryName Name of the performance entry shown in DevTools.
   * @param duration Fixed duration in ms; when omitted, the entry ends now.
   */
  private recordMeasure(
    entryName: string,
    start: DOMHighResTimeStamp,
    trackGroup: string,
    track: string,
    properties?: [string, any][],
    duration?: number,
  ): PerformanceMeasure {
    const measure = recordTrackEntry(entryName, start, trackGroup, track, properties, duration);

    this.debug(`[${track}]: ${entryName} took ${measure.duration}`, properties);
    return measure;
  }

  mark(name: string): PerformanceMark {
    const mark = performance.mark(name, {
      detail: {
        devtools: {
          dataType: "marker",
        },
      },
    });

    this.debug(mark.name, new Date().toISOString());

    return mark;
  }
}

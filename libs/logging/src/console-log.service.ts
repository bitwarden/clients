// import { parse } from "stacktrace-parser";
import StackTrace from "stacktrace-js";

import {
  EventDefinition,
  FieldValue,
  Span,
  SpanDefinition,
  TracingLevel,
} from "@bitwarden/sdk-internal";

import { LogLevel } from "./log-level";
import { LogService } from "./log.service";

export class ConsoleLogService implements LogService {
  protected timersMap: Map<string, [number, number]> = new Map();
  protected spanDefinitions = new Map<string, SpanDefinition>();
  protected eventDefinitions = new Map<string, EventDefinition>();

  constructor(
    protected isDev: boolean,
    protected filter: ((level: LogLevel) => boolean) | null = null,
  ) {}

  /**
   * Creates a new span.
   * @param name Name of the span to create. Must be unique in the application.
   * // TODO: Consider creating the name as we do state KeyDefinitions.
   */
  span(name: string, level: TracingLevel, fields: FieldValue[]): Span {
    let definition = this.spanDefinitions.get(name);
    if (!definition) {
      // TODO: A better way to get the caller info would be to use Webpack to modify
      // the code calling logService.span(...) at compile time to inject the file, line, and function name.
      const stack = StackTrace.getSync();
      const callee = stack[1];
      definition = new SpanDefinition(
        name,
        "",
        level,
        fields.map((f) => f.name),
        callee.fileName,
        callee.lineNumber,
        callee.functionName,
      );
      this.spanDefinitions.set(name, definition);
    }
    return definition.enter(fields);
  }

  event(
    span: Span,
    name: string,
    message: string,
    level: TracingLevel,
    fields: FieldValue[],
  ): void {
    let definition = this.eventDefinitions.get(name);
    if (!definition) {
      // TODO: A better way to get the caller info would be to use Webpack to modify
      // the code calling logService.event(...) at compile time to inject the file, line, and function name.
      const stack = StackTrace.getSync();
      const callee = stack[1];

      definition = new EventDefinition(
        name,
        callee.functionName ?? "",
        level,
        fields.map((f) => f.name),
        callee.fileName,
        callee.lineNumber,
        callee.functionName,
      );
      this.eventDefinitions.set(name, definition);
    }
    span.event(definition, message);
  }

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
    const measureName = `[${track}]: ${name}`;

    const measure = performance.measure(measureName, {
      start: start,
      detail: {
        devtools: {
          dataType: "track-entry",
          track,
          trackGroup,
          properties,
        },
      },
    });

    this.info(`${measureName} took ${measure.duration}`, properties);
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

    this.info(mark.name, new Date().toISOString());

    return mark;
  }
}

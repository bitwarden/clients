import { Jsonify } from "type-fest";

import { LogLevel } from "./log-level";
import { LogService } from "./log.service";
import { SemanticLogger } from "./semantic-logger.abstraction";

/** Sends semantic logs to the console.
 *  @remarks the behavior of this logger is based on `LogService`; it
 *   replaces dynamic messages (`%s`) with a JSON-formatted semantic log.
 */
export class DefaultSemanticLogger<Context extends object> implements SemanticLogger {
  /** Instantiates a console semantic logger
   *  @param context a static payload that is cloned when the logger
   *   logs a message. The `messages`, `level`, and `content` fields
   *   are reserved for use by loggers.
   */
  constructor(
    private logger: LogService,
    context: Jsonify<Context>,
    private now = () => Date.now(),
  ) {
    this.context = context && typeof context === "object" ? context : {};
  }

  readonly context: object;

  debug<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevel.Debug, message);
  }

  info<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevel.Info, message);
  }

  warn<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevel.Warning, message);
  }

  error<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevel.Error, message);
  }

  panic<T>(content: Jsonify<T>, message?: string): never {
    this.log(content, LogLevel.Error, message);
    const panicMessage =
      message ?? (typeof content === "string" ? content : "a fatal error occurred");
    throw new Error(panicMessage);
  }

  private log<T>(content: Jsonify<T>, level: LogLevel, message?: string) {
    const log = {
      ...this.context,
      message,
      content: content ?? undefined,
      level: stringifyLevel(level),
      "@timestamp": this.now(),
    };

    if (typeof content === "string" && !message) {
      log.message = content;
      delete log.content;
    }

    this.logger.write(level, log);
  }
}

function stringifyLevel(level: LogLevel) {
  switch (level) {
    case LogLevel.Debug:
      return "debug";
    case LogLevel.Info:
      return "information";
    case LogLevel.Warning:
      return "warning";
    case LogLevel.Error:
      return "error";
    default:
      return `${level}`;
  }
}
